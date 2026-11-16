<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Events\LeaseNoticeRecorded;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('enregistre le préavis du locataire d\'un logement vide : départ trois mois après la réception', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    $apres = E::poser($this->org, $bail, E::preavis($bail));
    $ligne = E::champs($this->org, $bail);

    expect($apres->lock_version)->toBe(2)
        ->and($ligne['given_by'])->toBe('tenant')
        ->and($ligne['received_on'])->toBe('2026-11-10')
        ->and($ligne['departure_on'])->toBe('2027-02-10')
        ->and($ligne['reason'])->toBe('Mutation professionnelle')
        ->and($ligne['version'])->toBe(2)
        ->and($ligne['status'])->toBe('signed');
});

it('ramène le préavis du locataire à un mois en zone tendue', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['jurisdiction_data' => ['tense_zone' => true]]);

    E::poser($this->org, $bail, E::preavis($bail));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2026-12-10');
});

it('ramène le préavis du locataire à un mois dans un cas listé', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['jurisdiction_data' => ['tenant_notice_reason' => 'job_loss']]);

    E::poser($this->org, $bail, E::preavis($bail));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2026-12-10');
});

it('fixe un mois pour le locataire d\'un meublé', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['regime_key' => 'fr.residential.furnished', 'duration_months' => 12, 'ends_on' => '2027-01-01']);

    E::poser($this->org, $bail, E::preavis($bail));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2026-12-10');
});

it('place le départ du congé du bailleur au terme du bail, six mois de préavis respectés', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise pour habiter']));
    $ligne = E::champs($this->org, $bail);

    expect($ligne['given_by'])->toBe('landlord')
        ->and($ligne['departure_on'])->toBe('2029-01-01');
});

it('fixe trois mois de préavis au bailleur d\'un meublé', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['regime_key' => 'fr.residential.furnished', 'duration_months' => 12, 'ends_on' => '2027-02-14']);

    E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Vente du logement', 'recu' => '2026-11-14']));
    $ligne = E::champs($this->org, $bail);

    expect($ligne['departure_on'])->toBe('2027-02-14');

    ['bail' => $trop] = E::bail($this->org, ['regime_key' => 'fr.residential.furnished', 'duration_months' => 12, 'ends_on' => '2027-02-13']);

    E::refus(fn () => E::poser($this->org, $trop, E::preavis($trop, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Vente du logement', 'recu' => '2026-11-14'])), 'lease_notice_invalid', 422);
});

it('refuse un congé du bailleur donné trop tard pour le terme', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['ends_on' => '2027-03-01']);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise pour habiter'])), 'lease_notice_invalid', 422);

    expect(E::champs($this->org, $bail)['received_on'])->toBeNull();
});

it('calcule le terme d\'un bail reconduit tacitement au premier anniversaire de période après le préavis', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['starts_on' => '2023-12-01', 'tacit_renewal' => true, 'ends_on' => null]);

    E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise pour habiter']));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2029-12-01');
});

it('refuse un départ du bailleur après le terme ou avant la fin du préavis', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise', 'depart' => '2029-01-02'])), 'lease_notice_invalid', 422);
    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise', 'depart' => '2027-05-09'])), 'lease_notice_invalid', 422);

    E::poser($this->org, $bail, E::preavis($bail, ['par' => NoticeGivenBy::Landlord, 'motif' => 'Reprise', 'depart' => '2027-05-10']));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2027-05-10');
});

it('accepte un départ du locataire plus tardif que le minimum légal, jamais plus proche', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['depart' => '2027-02-09'])), 'lease_notice_invalid', 422);
    expect(E::champs($this->org, $bail)['received_on'])->toBeNull();

    E::poser($this->org, $bail, E::preavis($bail, ['depart' => '2027-04-30']));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2027-04-30');
});

it('refuse un préavis sans motif', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['motif' => '   '])), 'lease_notice_invalid', 422);

    expect(E::champs($this->org, $bail)['received_on'])->toBeNull();
});

it('refuse une réception dans le futur ou antérieure à la signature', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['recu' => '2026-11-17'])), 'lease_notice_invalid', 422);
    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['recu' => '2025-12-14'])), 'lease_notice_invalid', 422);
});

it('refuse un régime sans préavis légal pour cette partie', function (string $regime, NoticeGivenBy $partie): void {
    ['bail' => $bail] = E::bail($this->org, ['regime_key' => $regime, 'duration_months' => 10, 'ends_on' => '2026-11-01']);
    $bail = E::relire($this->org, $bail);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['par' => $partie, 'recu' => '2026-06-01'])), 'lease_notice_invalid', 422);
})->with([
    'bailleur d\'un bail mobilité' => ['fr.residential.mobility', NoticeGivenBy::Landlord],
    'locataire du droit commun' => ['fr.common_law', NoticeGivenBy::Tenant],
]);

it('refuse un second préavis sans remplacement explicite et ne touche à rien', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::refus(fn () => E::poser($this->org, $apres, E::preavis($apres, ['recu' => '2026-11-12', 'motif' => 'Autre motif'])), 'lease_notice_exists', 409);

    $ligne = E::champs($this->org, $bail);

    expect($ligne['received_on'])->toBe('2026-11-10')
        ->and($ligne['reason'])->toBe('Mutation professionnelle')
        ->and($ligne['version'])->toBe(2);
});

it('remplace le préavis avec replace, tous les champs ensemble', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::poser($this->org, $apres, E::preavis($apres, ['recu' => '2026-11-12', 'motif' => 'Perte d\'emploi', 'par' => NoticeGivenBy::Landlord, 'remplace' => true]));
    $ligne = E::champs($this->org, $bail);

    expect($ligne['given_by'])->toBe('landlord')
        ->and($ligne['received_on'])->toBe('2026-11-12')
        ->and($ligne['departure_on'])->toBe('2029-01-01')
        ->and($ligne['reason'])->toBe('Perte d\'emploi')
        ->and($ligne['version'])->toBe(3)
        ->and(AuditLog::query()->where('action', 'leases.lease.notice_recorded')->latest('occurred_at')->firstOrFail()->metadata['replaced'])->toBeTrue();
});

it('refuse un bail brouillon, terminé, annulé ou archivé', function (): void {
    ['bail' => $brouillon] = E::bail($this->org, ['status' => LeaseStatus::Draft, 'signed_on' => null]);
    E::refus(fn () => E::poser($this->org, $brouillon, E::preavis($brouillon)), 'lease_not_signed', 409);

    foreach ([LeaseStatus::Terminated, LeaseStatus::Cancelled] as $statut) {
        ['bail' => $clos] = E::bail($this->org);
        E::statut($this->org, $clos, $statut);
        E::refus(fn () => E::poser($this->org, $clos, E::preavis($clos)), 'lease_already_terminated', 409);
    }

    ['bail' => $archive] = E::bail($this->org, ['archived_at' => now()]);
    E::refus(fn () => E::poser($this->org, $archive, E::preavis($archive)), 'lease_archived', 409);
});

it('refuse une version périmée', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['version' => 7])), 'lease_stale_version', 409);

    expect(E::champs($this->org, $bail)['version'])->toBe(1);
});

it('vérifie la version sur la ligne verrouillée : une écriture concurrente avant le verrou est vue', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::beforeExecuting(function (string $sql) use (&$declenchee, $niveau, $bail): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('leases')->where('id', $bail->id)->update(['lock_version' => 2]);
    });

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail)), 'lease_stale_version', 409);

    expect($declenchee)->toBeTrue()
        ->and(E::champs($this->org, $bail)['received_on'])->toBeNull();
});

it('cloisonne par organisation : le bail d\'une autre organisation est introuvable', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $autre = L::organisation();

    E::refus(fn () => E::poser($autre, $bail, E::preavis($bail)), 'lease_not_found', 404);

    expect(E::champs($this->org, $bail)['received_on'])->toBeNull();
});

it('émet l\'événement avec les seuls identifiants, après le commit', function (): void {
    $vus = [];
    Event::listen(LeaseNoticeRecorded::class, function (LeaseNoticeRecorded $e) use (&$vus): void {
        $vus[] = [$e->leaseId, $e->organizationId, DB::transactionLevel()];
    });
    ['bail' => $bail] = E::bail($this->org);
    $niveau = DB::transactionLevel();

    DB::transaction(function () use ($bail, &$vus): void {
        E::poser($this->org, $bail, E::preavis($bail));

        expect($vus)->toBe([]);
    });

    expect($vus)->toBe([[$bail->id, $this->org->id, $niveau]])
        ->and((new ReflectionClass(LeaseNoticeRecorded::class))->getConstructor()?->getParameters())->toHaveCount(2);
});

it('n\'émet rien quand le préavis est refusé', function (): void {
    Event::fake([LeaseNoticeRecorded::class]);
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['depart' => '2026-12-01'])), 'lease_notice_invalid', 422);

    Event::assertNotDispatched(LeaseNoticeRecorded::class);
});

it('journalise le préavis sans le motif en clair', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::poser($this->org, $bail, E::preavis($bail, ['motif' => 'Motif confidentiel du départ']));

    $journal = AuditLog::query()->where('subject_id', $bail->id)->where('action', 'leases.lease.notice_recorded')->firstOrFail();

    expect($journal->metadata)->toBe(['given_by' => 'tenant', 'received_on' => '2026-11-10', 'departure_on' => '2027-02-10', 'replaced' => false])
        ->and(AuditLog::query()->where('subject_id', $bail->id)->get()->toJson())->not->toContain('Motif confidentiel du départ');
});
