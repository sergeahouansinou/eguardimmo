<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Notifications\BankAccountChangedAlertNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Parties\PartiesContext as C;
use Tests\Feature\Tenant\TenantContext as T;

const AGENCE_IBAN = 'FR7630006000011234567890189';
const AGENCE_IBAN_2 = 'DE89370400440532013000';

beforeEach(function (): void {
    C::semer();
    Notification::fake();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->partie = C::partie($this->org, ['last_name' => 'Diallo', 'first_name' => 'Awa', 'display_name' => 'Awa Diallo']);
    T::emailPrincipal($this->org, $this->partie, 'principale@exemple.fr');
    $this->url = C::url($this->org, "/{$this->partie->id}/bank-accounts");
    $this->corps = ['iban' => AGENCE_IBAN, 'holder_name' => 'Awa Diallo', 'valid_from' => '2026-01-01'];
    $this->lignes = fn (): int => DB::table('bank_accounts')->count();
});

it('refuse l\'écriture d\'un IBAN sans double authentification confirmée, rien d\'écrit', function (): void {
    $gestionnaire = C::membre($this->org, MemberRole::Manager);
    C::sessionAgence($this, $gestionnaire);

    $this->postJson($this->url, $this->corps)->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    $this->postJson("{$this->url}/".fake()->uuid().'/replacement', $this->corps)->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    expect(($this->lignes)())->toBe(0);
    Notification::assertNothingSent();
});

it('refuse l\'écriture d\'un IBAN sans preuve 2FA récente, même avec la 2FA confirmée', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, $this->corps)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    $this->postJson("{$this->url}/".fake()->uuid().'/replacement', $this->corps)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(($this->lignes)())->toBe(0);
});

it('refuse une preuve par mot de passe seul : la preuve doit être un code 2FA', function (): void {
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->flushSession();
    $this->withSession(['auth.password_confirmed_at' => now()->getTimestamp()]);
    O::comme($this, $this->titulaire)->withHeaders(O::ORIGINE);

    $this->postJson($this->url, $this->corps)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
});

it('écrit puis remplace un IBAN avec la preuve, et alerte l\'adresse principale de la fiche sans l\'IBAN', function (): void {
    C::sessionAgence($this, $this->titulaire);

    $ancien = $this->postJson($this->url, $this->corps)->assertCreated()->json('data.id');
    $this->postJson("{$this->url}/{$ancien}/replacement", [...$this->corps, 'iban' => AGENCE_IBAN_2, 'valid_from' => '2026-06-01'])->assertCreated();

    expect(($this->lignes)())->toBe(2);
    Notification::assertSentOnDemandTimes(BankAccountChangedAlertNotification::class, 2);
    Notification::assertSentOnDemand(BankAccountChangedAlertNotification::class, function (BankAccountChangedAlertNotification $n, array $canaux, object $notifiable): bool {
        $texte = json_encode($n->toMail($notifiable)->toArray(), JSON_THROW_ON_ERROR);

        return $notifiable->routes['mail'] === 'principale@exemple.fr' && ! str_contains($texte, 'FR76') && ! str_contains($texte, '0189') && ! str_contains($texte, 'Awa Diallo');
    });
    expect(AuditLog::query()->where('subject_type', 'bank_account')->exists())->toBeTrue();
});

it('ne prévient personne et n\'échoue pas quand la fiche n\'a pas d\'adresse principale', function (): void {
    $sans = C::partie($this->org, ['last_name' => 'Martin', 'first_name' => 'Paul', 'display_name' => 'Paul Martin']);
    C::sessionAgence($this, $this->titulaire);

    $this->postJson(C::url($this->org, "/{$sans->id}/bank-accounts"), $this->corps)->assertCreated();

    Notification::assertNothingSent();
});

it('409 owner_access_requires_payout_request tant qu\'un accès propriétaire est vivant : le circuit du mandant s\'impose', function (): void {
    $compte = User::factory()->create(['email' => 'awa@exemple.fr']);
    C::sessionAgence($this, $this->titulaire);
    $ancien = $this->postJson($this->url, $this->corps)->assertCreated()->json('data.id');
    $acces = O::acces($this->org, $this->partie, $compte);
    $avant = ($this->lignes)();

    $this->postJson($this->url, [...$this->corps, 'iban' => AGENCE_IBAN_2])->assertConflict()->assertJsonPath('code', 'owner_access_requires_payout_request');
    $this->postJson("{$this->url}/{$ancien}/replacement", [...$this->corps, 'iban' => AGENCE_IBAN_2, 'valid_from' => '2026-06-01'])->assertConflict()->assertJsonPath('code', 'owner_access_requires_payout_request');

    expect(($this->lignes)())->toBe($avant)->and(BankAccount::query()->withoutGlobalScopes()->whereKey($ancien)->value('valid_to'))->toBeNull();
    Notification::assertSentOnDemandTimes(BankAccountChangedAlertNotification::class, 1);

    C::dans($this->org, fn () => $acces->forceFill(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization'])->save());

    $this->postJson($this->url, [...$this->corps, 'iban' => AGENCE_IBAN_2])->assertCreated();
});

it('le refus d\'un accès vivant ne vaut que pour la fiche du mandant : une autre fiche reste modifiable', function (): void {
    $compte = User::factory()->create(['email' => 'awa@exemple.fr']);
    O::acces($this->org, $this->partie, $compte);
    $autre = C::partie($this->org, ['last_name' => 'Martin', 'first_name' => 'Paul', 'display_name' => 'Paul Martin']);
    C::sessionAgence($this, $this->titulaire);

    $this->postJson(C::url($this->org, "/{$autre->id}/bank-accounts"), $this->corps)->assertCreated();
});
