<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\Party;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasePartiesContext as P;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->bail = P::bailSigne($this->org);
    $this->locataire = P::ligne($this->org, $this->bail);
    $this->nouvelle = L::partie($this->org);
    $this->actingAs($this->titulaire);
    $this->intact = function (): void {
        expect(P::version($this->org, $this->bail))->toBe(1)
            ->and(P::lignes($this->org, $this->bail))->toHaveCount(1);
    };
});

it('ajoute un colocataire à un bail signé : ligne ouverte aujourd\'hui, version incrémentée, bail renvoyé', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'tenant', ['joint_liability' => true])
        ->assertCreated()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(2, 'data.parties')
        ->assertJsonPath('data.parties.1.party.id', $this->nouvelle->id)
        ->assertJsonPath('data.parties.1.role', 'tenant')
        ->assertJsonPath('data.parties.1.joint_liability', true)
        ->assertJsonPath('data.parties.1.valid_from', '2026-11-16')
        ->assertJsonPath('data.parties.1.end_date', null)
        ->assertJsonPath('data.parties.1.guarantee', null);

    expect(P::lignes($this->org, $this->bail)[1])->toBe(['party_id' => $this->nouvelle->id, 'role' => 'tenant', 'from' => '2026-11-16', 'to' => null, 'guarantees' => null])
        ->and(P::version($this->org, $this->bail))->toBe(2)
        ->and(L::dans($this->org, fn () => LeaseParty::query()->where('party_id', $this->nouvelle->id)->firstOrFail()->organization_id))->toBe($this->org->id);
});

it('borne la date par défaut au début du bail', function (): void {
    $brouillon = P::brouillon($this->org);

    P::ajouter($this, $brouillon, $this->nouvelle->id)->assertCreated()->assertJsonPath('data.parties.0.valid_from', '2027-02-01');
});

it('accepte une date d\'entrée explicite dans la vie du bail', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'occupant', ['valid_from' => '2028-12-31'])->assertCreated();

    expect(P::lignes($this->org, $this->bail)[1]['from'])->toBe('2028-12-31');
});

it('refuse une date d\'entrée hors de la vie du bail', function (string $date, array $bail): void {
    $cible = P::bailSigne($this->org, $bail + ['reference' => 'BL-2026-0777']);

    P::ajouter($this, $cible, $this->nouvelle->id, 'tenant', ['valid_from' => $date])->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');

    expect(P::lignes($this->org, $cible))->toBe([])
        ->and(P::version($this->org, $cible))->toBe(1);
})->with([
    'avant le début' => ['2025-12-31', []],
    'le jour de la fin exclue' => ['2029-01-01', []],
    'après la fin' => ['2029-06-01', []],
    'le jour du départ du préavis' => ['2026-12-01', ['notice_departure_on' => '2026-12-01']],
]);

it('refuse l\'ajout par défaut quand le bail est déjà fini', function (): void {
    $fini = P::bailSigne($this->org, ['ends_on' => '2026-06-01', 'reference' => 'BL-2026-0778']);

    P::ajouter($this, $fini, $this->nouvelle->id)->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
});

it('ajoute un garant d\'un seul colocataire avec plafond dans la devise du bail', function (): void {
    $colocataire = P::ligne($this->org, $this->bail);
    $garant = L::partie($this->org);

    P::ajouter($this, $this->bail, $garant->id, 'guarantor', [
        'guarantees_party_id' => $colocataire->party_id,
        'guarantee_limit_amount' => 1200000,
        'guarantee_ends_on' => '2027-12-31',
        'currency' => 'USD',
    ])
        ->assertCreated()
        ->assertJsonPath('data.parties.2.guarantees_party_id', $colocataire->party_id)
        ->assertJsonPath('data.parties.2.guarantee.limit.amount', 1200000)
        ->assertJsonPath('data.parties.2.guarantee.limit.currency', 'EUR')
        ->assertJsonPath('data.parties.2.guarantee.ends_on', '2027-12-31');

    $ligne = L::dans($this->org, fn () => LeaseParty::query()->where('party_id', $garant->id)->firstOrFail());

    expect($ligne->guarantee_currency)->toBe('EUR')
        ->and($ligne->valid_to)->toBeNull()
        ->and(P::ouvertes($this->org, $this->bail, 'tenant'))->toBe(2);
});

it('ajoute un garant du bail entier sans locataire visé', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'guarantor')->assertCreated();

    expect(P::lignes($this->org, $this->bail)[1]['guarantees'])->toBeNull();
});

it('ferme la garantie à la date de départ déjà programmée du locataire garanti', function (): void {
    $partant = P::ligne($this->org, $this->bail, ['valid_to' => '2027-03-01']);

    P::ajouter($this, $this->bail, $this->nouvelle->id, 'guarantor', ['guarantees_party_id' => $partant->party_id])->assertCreated();

    expect(P::lignes($this->org, $this->bail)[2]['to'])->toBe('2027-03-01');
});

it('refuse un garant dont le locataire visé n\'est pas un locataire du bail à cette date', function (string $cas): void {
    $autre = P::bailSigne($this->org, ['reference' => 'BL-2026-0779']);
    $cible = match ($cas) {
        'occupant' => P::ligne($this->org, $this->bail, ['role' => 'occupant'])->party_id,
        'inconnu' => (string) Str::uuid7(),
        'parti' => P::ligne($this->org, $this->bail, ['valid_to' => '2026-06-01'])->party_id,
        'futur' => P::ligne($this->org, $this->bail, ['valid_from' => '2027-06-01'])->party_id,
        'autre bail' => P::ligne($this->org, $autre)->party_id,
    };
    $avant = P::lignes($this->org, $this->bail);

    P::ajouter($this, $this->bail, $this->nouvelle->id, 'guarantor', ['guarantees_party_id' => $cible])
        ->assertNotFound()->assertJsonPath('code', 'lease_party_not_found');

    expect(P::lignes($this->org, $this->bail))->toBe($avant)
        ->and(P::version($this->org, $this->bail))->toBe(1);
})->with(['occupant', 'inconnu', 'parti', 'futur', 'autre bail']);

it('refuse une caution sur un autre rôle que garant, un garant de lui-même et un plafond nul', function (array $extra, string $role, string $champ): void {
    $partie = $this->nouvelle->id;
    $extra = array_map(fn (mixed $v): mixed => $v === 'soi' ? $partie : $v, $extra);

    P::ajouter($this, $this->bail, $partie, $role, $extra)->assertUnprocessable()->assertJsonValidationErrors($champ);
    ($this->intact)();
})->with([
    'plafond sur un occupant' => [['guarantee_limit_amount' => 5000], 'occupant', 'role'],
    'cible sur un locataire' => [['guarantees_party_id' => '01934f6e-0000-7000-8000-00000000000a'], 'tenant', 'role'],
    'fin de caution sur un occupant' => [['guarantee_ends_on' => '2027-01-01'], 'occupant', 'role'],
    'garant de lui-même' => [['guarantees_party_id' => 'soi'], 'guarantor', 'guarantees_party_id'],
    'plafond nul' => [['guarantee_limit_amount' => 0], 'guarantor', 'guarantee_limit_amount'],
]);

it('refuse une fin de caution qui ne suit pas le début de la ligne', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'guarantor', ['guarantee_ends_on' => '2026-11-16'])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->intact)();
});

it('refuse deux fois le même rôle pour la même partie sur des périodes qui se recoupent', function (array $attributs): void {
    $existante = P::ligne($this->org, $this->bail, $attributs);

    P::ajouter($this, $this->bail, $existante->party_id, 'tenant')->assertConflict()->assertJsonPath('code', 'lease_party_conflict');

    expect(P::lignes($this->org, $this->bail))->toHaveCount(2)
        ->and(P::version($this->org, $this->bail))->toBe(1);
})->with([
    'ligne ouverte' => [[]],
    'départ programmé après l\'entrée' => [['valid_to' => '2027-03-01']],
    'ligne ouverte qui commence plus tard' => [['valid_from' => '2027-06-01']],
]);

it('autorise un autre rôle pour la même partie, et le retour d\'une partie dont la ligne est close', function (): void {
    P::ajouter($this, $this->bail, $this->locataire->party_id, 'occupant')->assertCreated();

    $partie = P::ligne($this->org, $this->bail, ['valid_to' => '2026-06-01']);
    P::ajouter($this, $this->bail, $partie->party_id, 'tenant')->assertCreated();

    expect(P::ouvertes($this->org, $this->bail, 'tenant'))->toBe(2)
        ->and(P::version($this->org, $this->bail))->toBe(3);
});

it('refuse une partie anonymisée, absente ou d\'une autre organisation', function (): void {
    $anonyme = L::partie($this->org);
    L::dans($this->org, fn () => Party::query()->findOrFail($anonyme->id)->forceFill(['anonymized_at' => now()])->save());
    $etrangere = L::partie(L::organisation());

    P::ajouter($this, $this->bail, $anonyme->id)->assertUnprocessable()->assertJsonPath('code', 'lease_party_not_available');
    P::ajouter($this, $this->bail, $etrangere->id)->assertNotFound()->assertJsonPath('code', 'party_not_found');
    P::ajouter($this, $this->bail, (string) Str::uuid7())->assertNotFound()->assertJsonPath('code', 'party_not_found');
    ($this->intact)();
});

it('refuse une version périmée sans rien écrire', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'tenant', ['lock_version' => 7])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    ($this->intact)();
});

it('accepte un brouillon et un bail signé, refuse un bail terminé, annulé ou archivé', function (LeaseStatus $statut, bool $archive, ?string $code): void {
    $cible = P::bailSigne($this->org, ['reference' => 'BL-2026-0780']);
    P::statut($this->org, $cible, $statut, $archive);

    $reponse = P::ajouter($this, $cible, $this->nouvelle->id);

    if ($code === null) {
        $reponse->assertCreated();
        expect(P::lignes($this->org, $cible))->toHaveCount(1);

        return;
    }

    $reponse->assertConflict()->assertJsonPath('code', $code);
    expect(P::lignes($this->org, $cible))->toBe([])->and(P::version($this->org, $cible))->toBe(1);
})->with([
    'brouillon' => [LeaseStatus::Draft, false, null],
    'signé' => [LeaseStatus::Signed, false, null],
    'terminé' => [LeaseStatus::Terminated, false, 'lease_already_terminated'],
    'annulé' => [LeaseStatus::Cancelled, false, 'lease_already_terminated'],
    'archivé' => [LeaseStatus::Signed, true, 'lease_archived'],
]);

it('journalise l\'ajout avec les identifiants seulement', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'tenant')->assertCreated();

    $ligne = L::dans($this->org, fn () => LeaseParty::query()->where('party_id', $this->nouvelle->id)->firstOrFail());
    $journal = AuditLog::query()->where('action', 'leases.party.added')->firstOrFail();

    expect($journal->subject_id)->toBe($this->bail->id)
        ->and($journal->actor_user_id)->toBe($this->titulaire->id)
        ->and($journal->organization_id)->toBe($this->org->id)
        ->and($journal->metadata)->toMatchArray(['lease_party_id' => $ligne->id, 'party_id' => $this->nouvelle->id, 'role' => 'tenant', 'valid_from' => '2026-11-16'])
        ->and(AuditLog::query()->where('subject_id', $ligne->id)->where('action', 'like', '%created')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('subject_id', $this->bail->id)->where('action', 'like', '%updated')->exists())->toBeTrue();
});

it('relit les lignes après le verrou du bail : un ajout concurrent du même rôle est vu', function (): void {
    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('lease_parties')->insert([
            'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'lease_id' => $this->bail->id, 'party_id' => $this->nouvelle->id,
            'role' => 'tenant', 'joint_liability' => 1, 'valid_from' => '2026-11-01', 'created_at' => now(), 'updated_at' => now(),
        ]);
    });

    P::ajouter($this, $this->bail, $this->nouvelle->id)->assertConflict()->assertJsonPath('code', 'lease_party_conflict');

    expect($declenchee)->toBeTrue()
        ->and(P::lignes($this->org, $this->bail))->toHaveCount(1)
        ->and(P::version($this->org, $this->bail))->toBe(1);
});

it('relit le locataire garanti après le verrou : un départ concurrent est vu', function (): void {
    $colocataire = P::ligne($this->org, $this->bail);
    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau, $colocataire): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('lease_parties')->where('id', $colocataire->id)->update(['valid_to' => '2026-11-01']);
    });

    P::ajouter($this, $this->bail, $this->nouvelle->id, 'guarantor', ['guarantees_party_id' => $colocataire->party_id])
        ->assertNotFound()->assertJsonPath('code', 'lease_party_not_found');

    expect($declenchee)->toBeTrue()
        ->and(P::lignes($this->org, $this->bail))->toHaveCount(2)
        ->and(P::version($this->org, $this->bail))->toBe(1);
});

it('valide la requête en liste blanche', function (array $surcharges, string $champ): void {
    $corps = P::corpsAjout($this->bail, $this->nouvelle->id, 'tenant', $surcharges);

    $this->postJson(P::urlAjout($this->org, $this->bail), $corps)->assertUnprocessable()->assertJsonValidationErrors($champ);
    ($this->intact)();
})->with([
    'version absente' => [['lock_version' => null], 'lock_version'],
    'partie absente' => [['party_id' => null], 'party_id'],
    'partie mal formée' => [['party_id' => 'abc'], 'party_id'],
    'rôle inconnu' => [['role' => 'bailleur'], 'role'],
    'solidarité non booléenne' => [['joint_liability' => 'peut-être'], 'joint_liability'],
    'date invalide' => [['valid_from' => '16/11/2026'], 'valid_from'],
    'plafond décimal' => [['guarantee_limit_amount' => 12.5], 'guarantee_limit_amount'],
    'fin de caution invalide' => [['guarantee_ends_on' => 'demain'], 'guarantee_ends_on'],
]);

it('ignore les champs que le client ne maîtrise pas', function (): void {
    P::ajouter($this, $this->bail, $this->nouvelle->id, 'tenant', ['organization_id' => (string) Str::uuid7(), 'lease_id' => (string) Str::uuid7(), 'valid_to' => '2026-12-01', 'currency' => 'USD'])->assertCreated();

    $ligne = L::dans($this->org, fn () => LeaseParty::query()->where('party_id', $this->nouvelle->id)->firstOrFail());

    expect($ligne->organization_id)->toBe($this->org->id)
        ->and($ligne->lease_id)->toBe($this->bail->id)
        ->and($ligne->valid_to)->toBeNull();
});

it('exige un compte authentifié, un rôle d\'écriture et ne voit pas les baux d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $bailAutre = P::bailSigne($autre, ['reference' => 'BL-2026-0781']);
    $corps = P::corpsAjout($this->bail, $this->nouvelle->id);

    $this->postJson(P::urlAjout($this->org, $bailAutre), $corps)->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    $this->postJson(P::urlAjout($autre, $bailAutre), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    $comptable = L::membre($this->org, MemberRole::Accountant);
    auth()->forgetGuards();
    $this->postJson(P::urlAjout($this->org, $this->bail), $corps)->assertUnauthorized();

    R::changerDeCompte($this, $comptable);
    $this->postJson(P::urlAjout($this->org, $this->bail), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    expect(P::lignes($autre, $bailAutre))->toBe([])->and(P::version($this->org, $this->bail))->toBe(1);
});
