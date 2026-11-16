<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\EndLeaseParty;
use App\Modules\Leases\Data\EndLeasePartyData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseTenantLeft;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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
    $this->a = P::ligne($this->org, $this->bail);
    $this->b = P::ligne($this->org, $this->bail);
    $this->actingAs($this->titulaire);
    $this->intact = function (): void {
        expect(P::version($this->org, $this->bail))->toBe(1)
            ->and(P::ouvertes($this->org, $this->bail))->toBe(2)
            ->and(P::lignes($this->org, $this->bail))->toHaveCount(2);
    };
});

function leasePartiesLigne(object $test, string $id): LeaseParty
{
    return L::dans($test->org, fn (): LeaseParty => LeaseParty::query()->findOrFail($id));
}

it('retire un colocataire : sa ligne est close à la date exclue, les autres locataires restent', function (): void {
    P::clore($this, $this->bail, $this->b, '2026-12-01')
        ->assertOk()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.parties.1.id', $this->b->id)
        ->assertJsonPath('data.parties.1.end_date', '2026-11-30')
        ->assertJsonPath('data.parties.0.end_date', null);

    expect(leasePartiesLigne($this, $this->b->id)->valid_to?->toDateString())->toBe('2026-12-01')
        ->and(leasePartiesLigne($this, $this->a->id)->valid_to)->toBeNull()
        ->and(P::version($this->org, $this->bail))->toBe(2);
});

it('accepte un départ le jour exact de la fin du bail', function (): void {
    P::clore($this, $this->bail, $this->b, '2029-01-01')->assertOk();

    expect(leasePartiesLigne($this, $this->b->id)->valid_to?->toDateString())->toBe('2029-01-01');
});

it('ne retire pas le dernier locataire : le bail se résilie par TerminateLease', function (): void {
    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertOk();

    P::clore($this, $this->bail, $this->a, '2027-01-01')->assertConflict()->assertJsonPath('code', 'lease_last_tenant');

    expect(leasePartiesLigne($this, $this->a->id)->valid_to)->toBeNull()
        ->and(P::ouvertes($this->org, $this->bail))->toBe(1)
        ->and(P::version($this->org, $this->bail))->toBe(2);
});

it('compte comme restant seulement un autre locataire sans date de fin déjà entré à la date de départ', function (string $cas): void {
    $bail = P::bailSigne($this->org, ['reference' => 'BL-2026-0790']);
    $seul = P::ligne($this->org, $bail);

    match ($cas) {
        'départ programmé' => P::ligne($this->org, $bail, ['valid_to' => '2027-06-01']),
        'arrivée après la date' => P::ligne($this->org, $bail, ['valid_from' => '2027-01-01']),
        'occupant' => P::ligne($this->org, $bail, ['role' => 'occupant']),
        'locataire déjà parti' => P::ligne($this->org, $bail, ['valid_to' => '2026-06-01']),
    };

    P::clore($this, $bail, $seul, '2026-12-01')->assertConflict()->assertJsonPath('code', 'lease_last_tenant');

    expect(leasePartiesLigne($this, $seul->id)->valid_to)->toBeNull()->and(P::version($this->org, $bail))->toBe(1);
})->with(['départ programmé', 'arrivée après la date', 'occupant', 'locataire déjà parti']);

it('compte un locataire qui arrive le jour même du départ', function (): void {
    $bail = P::bailSigne($this->org, ['reference' => 'BL-2026-0791']);
    $partant = P::ligne($this->org, $bail);
    P::ligne($this->org, $bail, ['valid_from' => '2026-12-01']);

    P::clore($this, $bail, $partant, '2026-12-01')->assertOk();
});

it('clôt à la même date les garanties propres au locataire qui part, sans toucher aux autres lignes', function (): void {
    $dejaClose = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->b->party_id, 'valid_to' => '2026-05-01']);
    $g1 = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->b->party_id]);
    $g2 = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->b->party_id, 'valid_to' => '2027-06-01']);
    $deA = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->a->party_id]);
    $global = P::ligne($this->org, $this->bail, ['role' => 'guarantor']);

    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertOk();

    $de = fn (string $id): ?string => leasePartiesLigne($this, $id)->valid_to?->toDateString();

    expect($de($g1->id))->toBe('2026-12-01')
        ->and($de($g2->id))->toBe('2026-12-01')
        ->and($de($this->b->id))->toBe('2026-12-01')
        ->and($de($dejaClose->id))->toBe('2026-05-01')
        ->and($de($deA->id))->toBeNull()
        ->and($de($global->id))->toBeNull()
        ->and($de($this->a->id))->toBeNull()
        ->and(leasePartiesLigne($this, $g1->id)->valid_from->toDateString())->toBe('2026-01-01');
});

it('refuse le départ quand une caution du locataire commence à cette date ou après', function (): void {
    $future = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->b->party_id, 'valid_from' => '2026-12-01']);

    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');

    expect(leasePartiesLigne($this, $this->b->id)->valid_to)->toBeNull()
        ->and(leasePartiesLigne($this, $future->id)->valid_to)->toBeNull()
        ->and(P::version($this->org, $this->bail))->toBe(1);
});

it('retire un garant ou un occupant sans règle de dernier locataire et sans événement de départ', function (string $role): void {
    Event::fake([LeaseTenantLeft::class]);
    $bail = P::bailSigne($this->org, ['reference' => 'BL-2026-0792']);
    P::ligne($this->org, $bail);
    $ligne = P::ligne($this->org, $bail, ['role' => $role]);

    P::clore($this, $bail, $ligne, '2026-12-01')->assertOk();

    expect(leasePartiesLigne($this, $ligne->id)->valid_to?->toDateString())->toBe('2026-12-01')
        ->and(P::ouvertes($this->org, $bail))->toBe(1);
    Event::assertNotDispatched(LeaseTenantLeft::class);
})->with(['guarantor', 'occupant']);

it('refuse une date de départ incohérente avec la ligne ou le bail', function (string $date, array $bail): void {
    $cible = P::bailSigne($this->org, ['reference' => 'BL-2026-0793', ...$bail]);
    P::ligne($this->org, $cible);
    $partant = P::ligne($this->org, $cible);

    P::clore($this, $cible, $partant, $date)->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');

    expect(leasePartiesLigne($this, $partant->id)->valid_to)->toBeNull()->and(P::version($this->org, $cible))->toBe(1);
})->with([
    'le jour de l\'entrée' => ['2026-01-01', []],
    'avant l\'entrée' => ['2025-06-01', []],
    'après la fin du bail' => ['2029-01-02', []],
    'après le départ du préavis' => ['2026-12-02', ['notice_departure_on' => '2026-12-01']],
]);

it('refuse une ligne déjà close', function (): void {
    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertOk();

    P::clore($this, $this->bail, $this->b, '2026-11-01')->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');

    expect(leasePartiesLigne($this, $this->b->id)->valid_to?->toDateString())->toBe('2026-12-01');
});

it('répond lease_party_not_found pour une ligne inconnue, d\'un autre bail ou d\'une autre organisation', function (): void {
    $autreBail = P::bailSigne($this->org, ['reference' => 'BL-2026-0794']);
    $duAutreBail = P::ligne($this->org, $autreBail);
    $autre = L::organisation();
    $etrangere = P::ligne($autre, P::bailSigne($autre, ['reference' => 'BL-2026-0795']));

    foreach ([(string) Str::uuid7(), $duAutreBail->id, $etrangere->id] as $id) {
        P::clore($this, $this->bail, $id, '2026-12-01', 1)->assertNotFound()->assertJsonPath('code', 'lease_party_not_found');
    }

    $this->postJson(P::urlFin($this->org, $this->bail, 'pas-un-uuid'), ['lock_version' => 1, 'valid_to' => '2026-12-01'])->assertNotFound();

    expect(leasePartiesLigne($this, $duAutreBail->id)->valid_to)->toBeNull();
    ($this->intact)();
});

it('refuse une version périmée sans rien écrire', function (): void {
    P::clore($this, $this->bail, $this->b, '2026-12-01', 5)->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    ($this->intact)();
});

it('accepte un brouillon et un bail signé, refuse un bail terminé, annulé ou archivé', function (LeaseStatus $statut, bool $archive, ?string $code): void {
    $cible = P::bailSigne($this->org, ['reference' => 'BL-2026-0796']);
    P::ligne($this->org, $cible);
    $partant = P::ligne($this->org, $cible);
    P::statut($this->org, $cible, $statut, $archive);

    $reponse = P::clore($this, $cible, $partant, '2026-12-01');

    if ($code === null) {
        $reponse->assertOk();
        expect(P::ouvertes($this->org, $cible))->toBe(1);

        return;
    }

    $reponse->assertConflict()->assertJsonPath('code', $code);
    expect(P::ouvertes($this->org, $cible))->toBe(2)->and(P::version($this->org, $cible))->toBe(1);
})->with([
    'brouillon' => [LeaseStatus::Draft, false, null],
    'signé' => [LeaseStatus::Signed, false, null],
    'terminé' => [LeaseStatus::Terminated, false, 'lease_already_terminated'],
    'annulé' => [LeaseStatus::Cancelled, false, 'lease_already_terminated'],
    'archivé' => [LeaseStatus::Signed, true, 'lease_archived'],
]);

it('journalise le départ, les garanties closes et les modifications de lignes', function (): void {
    $garantie = P::ligne($this->org, $this->bail, ['role' => 'guarantor', 'guarantees_party_id' => $this->b->party_id]);

    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertOk();

    $journal = AuditLog::query()->where('action', 'leases.party.ended')->firstOrFail();

    expect($journal->subject_id)->toBe($this->bail->id)
        ->and($journal->actor_user_id)->toBe($this->titulaire->id)
        ->and($journal->organization_id)->toBe($this->org->id)
        ->and($journal->metadata)->toMatchArray([
            'lease_party_id' => $this->b->id, 'party_id' => $this->b->party_id, 'role' => 'tenant', 'valid_to' => '2026-12-01', 'guarantees_closed' => [$garantie->id],
        ])
        ->and(AuditLog::query()->where('subject_id', $this->b->id)->where('action', 'like', '%updated')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('subject_id', $garantie->id)->where('action', 'like', '%updated')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('subject_id', $this->bail->id)->where('action', 'like', '%updated')->exists())->toBeTrue();
});

it('publie LeaseTenantLeft avec les identifiants et la date seulement', function (): void {
    Event::fake([LeaseTenantLeft::class]);

    P::clore($this, $this->bail, $this->b, '2026-12-01')->assertOk();

    Event::assertDispatchedTimes(LeaseTenantLeft::class, 1);
    Event::assertDispatched(LeaseTenantLeft::class, fn (LeaseTenantLeft $e): bool => $e->leaseId === $this->bail->id
        && $e->organizationId === $this->org->id && $e->partyId === $this->b->party_id && $e->leftOn === '2026-12-01');
});

it('n\'émet l\'événement qu\'après le commit et rien quand le départ est refusé', function (): void {
    $vus = [];
    Event::listen(LeaseTenantLeft::class, function () use (&$vus): void {
        $vus[] = DB::transactionLevel();
    });
    $niveau = DB::transactionLevel();

    DB::transaction(function () use (&$vus): void {
        L::dans($this->org, fn () => app(EndLeaseParty::class)->handle($this->bail, $this->b->id, new EndLeasePartyData(1, '2026-12-01')));

        expect($vus)->toBe([]);
    });

    expect($vus)->toBe([$niveau]);

    P::clore($this, $this->bail, $this->a, '2027-01-01')->assertConflict();

    expect($vus)->toBe([$niveau]);
});

it('relit les lignes après le verrou du bail : un départ concurrent est vu et le bail garde un locataire', function (): void {
    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('lease_parties')->where('id', $this->b->id)->update(['valid_to' => '2026-11-20']);
    });

    P::clore($this, $this->bail, $this->a, '2026-12-01')->assertConflict()->assertJsonPath('code', 'lease_last_tenant');

    expect($declenchee)->toBeTrue()
        ->and(leasePartiesLigne($this, $this->a->id)->valid_to)->toBeNull();
    ($this->intact)();
});

it('laisse un locataire au bail quand deux départs se suivent', function (): void {
    $debut = P::clore($this, $this->bail, $this->a, '2026-12-01');
    $suite = P::clore($this, $this->bail, $this->b, '2026-12-01');

    $debut->assertOk();
    $suite->assertConflict()->assertJsonPath('code', 'lease_last_tenant');

    expect(P::ouvertes($this->org, $this->bail))->toBe(1);
});

it('valide la requête en liste blanche', function (array $surcharges, string $champ): void {
    $corps = ['lock_version' => 1, 'valid_to' => '2026-12-01', ...$surcharges];

    $this->postJson(P::urlFin($this->org, $this->bail, $this->b), $corps)->assertUnprocessable()->assertJsonValidationErrors($champ);
    ($this->intact)();
})->with([
    'version absente' => [['lock_version' => null], 'lock_version'],
    'version nulle' => [['lock_version' => 0], 'lock_version'],
    'date absente' => [['valid_to' => null], 'valid_to'],
    'date invalide' => [['valid_to' => '01/12/2026'], 'valid_to'],
    'date trop ancienne' => [['valid_to' => '1999-01-01'], 'valid_to'],
]);

it('exige un compte authentifié, un rôle d\'écriture et ne voit pas les baux d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $bailAutre = P::bailSigne($autre, ['reference' => 'BL-2026-0797']);
    P::ligne($autre, $bailAutre);
    $partantAutre = P::ligne($autre, $bailAutre);
    $corps = ['lock_version' => 1, 'valid_to' => '2026-12-01'];

    $this->postJson(P::urlFin($this->org, $bailAutre, $partantAutre), $corps)->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    $this->postJson(P::urlFin($autre, $bailAutre, $partantAutre), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    $comptable = L::membre($this->org, MemberRole::Accountant);
    auth()->forgetGuards();
    $this->postJson(P::urlFin($this->org, $this->bail, $this->b), $corps)->assertUnauthorized();

    R::changerDeCompte($this, $comptable);
    $this->postJson(P::urlFin($this->org, $this->bail, $this->b), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    expect(leasePartiesLigne($this, $this->b->id)->valid_to)->toBeNull()
        ->and(P::ouvertes($autre, $bailAutre))->toBe(2);
    ($this->intact)();
});
