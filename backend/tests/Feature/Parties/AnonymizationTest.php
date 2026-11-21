<?php

declare(strict_types=1);

require_once __DIR__.'/../Accounting/helpers.php';

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Identity\Actions\DeleteAccount;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Parties\Listeners\AnonymizePartiesOfDeletedAccount;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Shared\Audit\AuditLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Money\Money;
use Tests\Feature\Parties\PartiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

/**
 * @return array{party: Party, contact: string, identifier: string, bank: string}
 */
function partiesFicheComplete(object $test, object $org, ?string $userId = null): array
{
    $partie = C::partie($org, ['last_name' => 'Dupont', 'first_name' => 'Jean', 'display_name' => 'Jean Dupont', 'birth_date' => '1985-04-12',
        'address' => ['line1' => '12 rue du Port', 'postal_code' => '13002', 'city' => 'Marseille', 'country' => 'FR'],
        'custom_fields' => ['code' => 'A1'], 'user_id' => $userId]);
    $url = C::url($org, "/{$partie->id}");

    C::sessionAgence($test, C::titulaire($org));
    $contact = $test->postJson("{$url}/contact-points", ['type' => 'email', 'value' => 'jean@exemple.fr', 'label' => 'Maison'])->json('data.id');
    $identifier = $test->postJson("{$url}/identifiers", ['scheme' => 'passport', 'country' => 'FR', 'value' => '12AB34567'])->json('data.id');
    $bank = $test->postJson("{$url}/bank-accounts", ['iban' => 'FR7630006000011234567890189', 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-01-01'])->json('data.id');

    return ['party' => $partie, 'contact' => $contact, 'identifier' => $identifier, 'bank' => $bank];
}

it('anonymise une fiche par la route sans supprimer aucune ligne ni toucher les autres fiches ni le grand livre', function (): void {
    $fiche = partiesFicheComplete($this, $this->org);
    $voisine = C::partie($this->org, ['last_name' => 'Martin', 'first_name' => 'Paul', 'display_name' => 'Paul Martin']);
    $autreOrg = C::organisation();
    $etrangere = C::partie($autreOrg, ['last_name' => 'Durand', 'display_name' => 'Marc Durand']);

    comptaPoster($this->org, comptaLoyer('rent:1', Money::EUR(120000), refs: ['party' => $fiche['party']->id]));
    $lignes = fn () => JournalLine::query()->where('party_id', $fiche['party']->id)->pluck('id')->sort()->values()->all();
    $avantLignes = comptaDans($this->org, $lignes);
    $avantEcritures = comptaDans($this->org, fn () => JournalEntry::query()->count());
    $comptes = fn (): array => [Party::class => DB::table('parties')->count(), ContactPoint::class => DB::table('contact_points')->count(),
        PartyIdentifier::class => DB::table('party_identifiers')->count(), BankAccount::class => DB::table('bank_accounts')->count()];
    $avantComptes = $comptes();
    $journalAvant = AuditLog::query()->where('subject_id', $fiche['party']->id)->count();

    C::sessionAgence($this, $this->titulaire)
        ->postJson(C::url($this->org, "/{$fiche['party']->id}/anonymization"))
        ->assertOk()
        ->assertJsonPath('data.is_anonymized', true)
        ->assertJsonPath('data.display_name', 'Contact anonymisé')
        ->assertJsonPath('data.last_name', null)
        ->assertJsonPath('data.birth_date', null)
        ->assertJsonPath('data.address', null)
        ->assertJsonPath('data.custom_fields', [])
        ->assertJsonPath('data.lock_version', 2);

    $brut = DB::table('parties')->where('id', $fiche['party']->id)->first();
    expect($brut->last_name)->toBeNull()->and($brut->first_name)->toBeNull()->and($brut->birth_date)->toBeNull()->and($brut->address)->toBeNull()
        ->and($brut->anonymized_at)->not->toBeNull();

    $point = DB::table('contact_points')->where('id', $fiche['contact'])->first();
    $piece = DB::table('party_identifiers')->where('id', $fiche['identifier'])->first();
    $compte = DB::table('bank_accounts')->where('id', $fiche['bank'])->first();
    expect($point->value)->toBeNull()->and($point->label)->toBeNull()->and((bool) $point->is_primary)->toBeFalse()
        ->and($piece->value)->toBeNull()->and($piece->value_hash)->toBeNull()
        ->and($compte->iban)->toBeNull()->and($compte->iban_last4)->toBeNull()->and($compte->iban_hash)->toBeNull()->and($compte->holder_name)->toBeNull()
        ->and($compte->valid_to)->not->toBeNull();

    expect($comptes())->toBe($avantComptes)
        ->and(AuditLog::query()->where('subject_id', $fiche['party']->id)->count())->toBeGreaterThan($journalAvant)
        ->and(AuditLog::query()->where('action', 'parties.party.anonymized')->where('subject_id', $fiche['party']->id)->count())->toBe(1)
        ->and(comptaDans($this->org, $lignes))->toBe($avantLignes)
        ->and(comptaDans($this->org, fn () => JournalEntry::query()->count()))->toBe($avantEcritures);

    $voisineApres = DB::table('parties')->where('id', $voisine->id)->first();
    $etrangereApres = DB::table('parties')->where('id', $etrangere->id)->first();
    expect($voisineApres->last_name)->toBe('Martin')->and($voisineApres->anonymized_at)->toBeNull()->and($voisineApres->lock_version)->toBe(1)
        ->and($etrangereApres->last_name)->toBe('Durand')->and($etrangereApres->anonymized_at)->toBeNull();
});

it('rend l\'anonymisation idempotente et verrouille ensuite la fiche', function (): void {
    $fiche = partiesFicheComplete($this, $this->org);
    $url = C::url($this->org, "/{$fiche['party']->id}");

    $this->postJson("{$url}/anonymization")->assertOk()->assertJsonPath('data.lock_version', 2);
    $this->postJson("{$url}/anonymization")->assertOk()->assertJsonPath('data.lock_version', 2);
    expect(AuditLog::query()->where('action', 'parties.party.anonymized')->count())->toBe(1);

    $this->patchJson($url, ['lock_version' => 2, 'first_name' => 'Retour'])->assertConflict()->assertJsonPath('code', 'party_anonymized');
    $this->postJson("{$url}/contact-points", ['type' => 'email', 'value' => 'neuf@exemple.fr'])->assertConflict()->assertJsonPath('code', 'party_anonymized');
    $this->postJson("{$url}/identifiers", ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])->assertConflict();
    $this->postJson("{$url}/bank-accounts", ['iban' => 'FR7630006000011234567890189', 'holder_name' => 'X'])->assertConflict();
    $this->patchJson("{$url}/contact-points/{$fiche['contact']}", ['label' => 'x'])->assertConflict();
    $this->postJson("{$url}/bank-accounts/{$fiche['bank']}/replacement", ['iban' => 'FR7630006000011234567890189', 'holder_name' => 'X'])->assertConflict();
});

it('anonymise par l\'événement AccountDeleted les parties du compte dans toutes les organisations, une seule fois', function (): void {
    $compte = User::factory()->create();
    $autreOrg = C::organisation();
    $a = partiesFicheComplete($this, $this->org, $compte->id);
    $b = partiesFicheComplete($this, $autreOrg, $compte->id);
    $tiers = partiesFicheComplete($this, $this->org, User::factory()->create()->id);
    $sansCompte = partiesFicheComplete($this, $this->org);

    AccountDeleted::dispatch($compte->id);

    $etat = fn (string $id): object => DB::table('parties')->where('id', $id)->first();
    expect($etat($a['party']->id)->anonymized_at)->not->toBeNull()
        ->and($etat($a['party']->id)->user_id)->toBeNull()
        ->and($etat($b['party']->id)->anonymized_at)->not->toBeNull()
        ->and($etat($b['party']->id)->last_name)->toBeNull()
        ->and(DB::table('bank_accounts')->where('id', $b['bank'])->value('iban'))->toBeNull()
        ->and($etat($tiers['party']->id)->anonymized_at)->toBeNull()
        ->and($etat($tiers['party']->id)->last_name)->toBe('Dupont')
        ->and($etat($sansCompte['party']->id)->anonymized_at)->toBeNull();

    $versions = [$etat($a['party']->id)->lock_version, $etat($b['party']->id)->lock_version];
    $journal = AuditLog::query()->count();

    AccountDeleted::dispatch($compte->id);
    app(AnonymizePartiesOfDeletedAccount::class)->handle(new AccountDeleted($compte->id));

    expect([$etat($a['party']->id)->lock_version, $etat($b['party']->id)->lock_version])->toBe($versions)
        ->and(AuditLog::query()->count())->toBe($journal)
        ->and(AuditLog::query()->where('action', 'parties.party.anonymized')->count())->toBe(2);
});

it('traite l\'événement en file', function (): void {
    expect(new ReflectionClass(AnonymizePartiesOfDeletedAccount::class)->implementsInterface(ShouldQueue::class))->toBeTrue();

    Queue::fake();
    $compte = User::factory()->create();
    $fiche = partiesFicheComplete($this, $this->org, $compte->id);

    AccountDeleted::dispatch($compte->id);

    Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $travail): bool => $travail->class === AnonymizePartiesOfDeletedAccount::class);
    expect(DB::table('parties')->where('id', $fiche['party']->id)->value('anonymized_at'))->toBeNull();
});

it('anonymise les fiches d\'un compte réellement supprimé', function (): void {
    $compte = User::factory()->create();
    $fiche = partiesFicheComplete($this, $this->org, $compte->id);

    app(DeleteAccount::class)->handle($compte);

    expect(DB::table('parties')->where('id', $fiche['party']->id)->value('anonymized_at'))->not->toBeNull()
        ->and(DB::table('parties')->where('id', $fiche['party']->id)->value('last_name'))->toBeNull();
});
