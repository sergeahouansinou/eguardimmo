<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    L::semer();
    C::fournisseur();
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->locataire = C::locataire($this->org, 'koffi@exemple.fr');
    $this->id = C::creer($this, $this->org, $this->titulaire);
    $this->piece = Str::uuid()->toString();
});

function routesCampagnes(object $test): array
{
    $id = $test->id;
    $piece = $test->piece;

    return [
        ['GET', ''], ['POST', ''], ['GET', '/audiences'], ['POST', '/test'],
        ['GET', "/{$id}"], ['PATCH', "/{$id}"], ['POST', "/{$id}/send"], ['POST', "/{$id}/schedule"], ['POST', "/{$id}/cancel"],
        ['POST', "/{$id}/attachments"], ['GET', "/{$id}/attachments/{$piece}"], ['DELETE', "/{$id}/attachments/{$piece}"],
    ];
}

it('répond 401 sans connexion sur chaque route', function (): void {
    auth()->forgetGuards();

    foreach (routesCampagnes($this) as [$methode, $suite]) {
        $this->json($methode, C::url($this->org, $suite))->assertUnauthorized();
    }
});

it('répond 403 au comptable sur chaque route, sans rien créer ni envoyer', function (): void {
    $comptable = L::membre($this->org, MemberRole::Accountant);

    foreach (routesCampagnes($this) as [$methode, $suite]) {
        C::appeler($this, $this->org, $comptable, $methode, $suite, C::corps(), true)->assertForbidden();
    }

    expect(Campaign::query()->count())->toBe(1)->and(Campaign::query()->findOrFail($this->id)->status->value)->toBe('draft');
    Mail::assertNothingSent();
});

it('cache l\'organisation (404) à un compte qui n\'en est pas membre, locataire ou jeton opérateur compris', function (): void {
    $etranger = User::factory()->create();
    activerDeuxFacteurs($etranger);

    foreach ([$etranger, $this->locataire['user']] as $compte) {
        foreach (routesCampagnes($this) as [$methode, $suite]) {
            C::appeler($this, $this->org, $compte, $methode, $suite, C::corps(), true)->assertNotFound();
        }
    }

    $operateur = A::operateur();
    A::jeton($this);

    foreach (routesCampagnes($this) as [$methode, $suite]) {
        $this->withToken($operateur['jeton'])->json($methode, C::url($this->org, $suite))->assertNotFound();
    }

    expect(L::dans($this->org, fn () => Campaign::query()->count()))->toBe(1);
    Mail::assertNothingSent();
});

it('autorise le gestionnaire et l\'administrateur à composer', function (): void {
    foreach ([MemberRole::Manager, MemberRole::Admin] as $role) {
        $compte = L::membre($this->org, $role);
        activerDeuxFacteurs($compte);

        C::appeler($this, $this->org, $compte, 'GET')->assertOk();
        C::appeler($this, $this->org, $compte, 'POST', '', C::corps(['subject' => "Par {$role->value}"]))->assertCreated();
    }
});

it('exige la double authentification activée et une preuve récente pour envoyer ou programmer', function (): void {
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $sansPreuve = fn (string $suite, array $corps = []) => C::appeler($this, $this->org, $this->titulaire, 'POST', $suite, $corps, false);

    $sansPreuve("/{$this->id}/send")->assertForbidden();
    $sansPreuve("/{$this->id}/schedule", ['scheduled_at' => now()->addHour()->toIso8601String()])->assertForbidden();
    C::appeler($this, $this->org, $gestionnaire, 'POST', "/{$this->id}/send", [], true)->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    expect(Campaign::query()->findOrFail($this->id)->status->value)->toBe('draft');
    Mail::assertNothingSent();

    activerDeuxFacteurs($gestionnaire);
    C::appeler($this, $this->org, $gestionnaire, 'POST', "/{$this->id}/send", [], true)->assertOk();
});

it('ne laisse jamais une organisation lire ou toucher la diffusion d\'une autre', function (): void {
    $autre = T::organisation('Autre agence');
    $titulaireAutre = C::titulaire($autre);
    $idAutre = C::creer($this, $autre, $titulaireAutre, ['subject' => 'Confidentiel de l\'autre agence']);

    foreach ([['GET', ''], ['GET', "/{$idAutre}"], ['PATCH', "/{$idAutre}"], ['POST', "/{$idAutre}/send"], ['POST', "/{$idAutre}/schedule"], ['POST', "/{$idAutre}/cancel"], ['POST', "/{$idAutre}/attachments"], ['DELETE', "/{$idAutre}/attachments/{$this->piece}"], ['GET', "/{$idAutre}/attachments/{$this->piece}"]] as [$methode, $suite]) {
        if ($methode === 'POST' && str_ends_with($suite, '/attachments')) {
            O::navigateurAgence($this);
            O::comme($this, $this->titulaire);
            $reponse = $this->post(C::url($this->org, $suite), ['file' => C::pdf()], ['Accept' => 'application/json']);
        } else {
            $reponse = C::appeler($this, $this->org, $this->titulaire, $methode, $suite, C::corps(['lock_version' => 1, 'scheduled_at' => now()->addHour()->toIso8601String()]), true);
        }

        if ($suite === '') {
            $reponse->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->id);
            expect($reponse->getContent())->not->toContain('Confidentiel');

            continue;
        }

        $reponse->assertNotFound();
        expect($reponse->getContent())->not->toContain('Confidentiel');
    }

    C::appeler($this, $autre, $this->titulaire, 'GET', "/{$idAutre}")->assertNotFound();
    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$idAutre}")->assertNotFound()->assertJsonPath('code', 'campaign_not_found');

    expect(Campaign::query()->withoutGlobalScopes()->findOrFail($idAutre)->status->value)->toBe('draft');
    Mail::assertNothingSent();
});

it('ne diffuse qu\'aux locataires de l\'organisation, calculés côté serveur', function (): void {
    $autre = T::organisation('Autre agence');
    C::locataire($autre, 'etranger@exemple.fr');

    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk()->assertJsonPath('data.recipient_count', 1);

    expect(Mail::sent(CampaignMail::class)->map(fn ($m): string => $m->to[0]['address'])->all())->toBe(['koffi@exemple.fr']);
});

it('ne renvoie jamais d\'erreur avec trace, requête SQL ou chemin', function (): void {
    $reponse = C::appeler($this, $this->org, $this->titulaire, 'GET', '/'.Str::uuid());

    $reponse->assertNotFound();
    expect($reponse->getContent())->not->toContain('vendor/')->not->toContain('select ')->not->toContain('App\\Modules')->not->toContain('trace');
});

it('refuse un identifiant de diffusion qui n\'est pas un UUID', function (): void {
    C::appeler($this, $this->org, $this->titulaire, 'GET', '/pas-un-uuid')->assertNotFound();
    C::appeler($this, $this->org, $this->titulaire, 'POST', '/pas-un-uuid/send', [], true)->assertNotFound();
});

it('refuse une page curseur falsifiée', function (): void {
    C::appeler($this, $this->org, $this->titulaire, 'GET', '?cursor='.base64_encode('{"id":"x\' OR 1=1","_pointsToNextItems":true}'))->assertUnprocessable();
    C::appeler($this, $this->org, $this->titulaire, 'GET', '?per_page=1000')->assertUnprocessable();
    C::appeler($this, $this->org, $this->titulaire, 'GET', '?status=pirate')->assertUnprocessable();
});
