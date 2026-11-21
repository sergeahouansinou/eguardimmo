<?php

declare(strict_types=1);

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\OccupancyData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Leases\Queries\UnitOccupations;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->lot = L::lot($this->org);
    $this->occupants = fn (string $jour): array => array_map(
        fn (OccupancyData $o): string => $o->leaseId,
        L::dans($this->org, fn (): array => app(LeaseDirectory::class)->occupancyAt([$this->lot->id], CarbonImmutable::parse($jour))),
    );
    $this->actifs = fn (string $de, string $a): array => array_map(
        fn (LeaseBillingData $b): string => $b->leaseId,
        L::dans($this->org, fn (): array => app(LeaseSchedule::class)->activeBetween(CarbonImmutable::parse($de), CarbonImmutable::parse($a), null, 50)),
    );
});

it('occupe le lot jusqu\'à la fin d\'un bail résilié dont la date de fin est future', function (): void {
    $bail = R::bailSigne($this->org, ['status' => LeaseStatus::Terminated, 'starts_on' => '2026-01-01', 'ends_on' => '2027-06-01']);
    R::occuper($this->org, $bail, $this->lot, ['valid_from' => '2026-01-01', 'valid_to' => '2027-06-01']);

    $periodes = L::dans($this->org, fn (): array => app(UnitOccupations::class)->of([$this->lot->id]));

    expect(($this->occupants)('2027-05-31'))->toBe([$bail->id])
        ->and(($this->occupants)('2027-06-01'))->toBe([])
        ->and($periodes)->toBe([['lease_id' => $bail->id, 'unit_id' => $this->lot->id, 'from' => '2026-01-01', 'to' => '2027-06-01']])
        ->and(($this->actifs)('2027-03-01', '2027-03-31'))->toBe([$bail->id])
        ->and(($this->actifs)('2027-06-01', '2027-06-30'))->toBe([]);
});

it('ne retient pas un bail résilié sans date de fin, ni un brouillon ou un bail annulé', function (): void {
    foreach ([[LeaseStatus::Terminated, null], [LeaseStatus::Draft, '2029-01-01'], [LeaseStatus::Cancelled, '2029-01-01']] as [$statut, $fin]) {
        $bail = R::bailSigne($this->org, ['status' => $statut, 'starts_on' => '2026-01-01', 'ends_on' => $fin]);
        R::occuper($this->org, $bail, $this->lot, ['valid_from' => '2026-01-01']);
    }

    expect(($this->occupants)('2026-06-01'))->toBe([])
        ->and(($this->actifs)('2026-06-01', '2026-06-30'))->toBe([])
        ->and(L::dans($this->org, fn (): array => app(UnitOccupations::class)->of([$this->lot->id])))->toBe([]);
});

it('borne l\'occupation au départ annoncé quand il précède la fin', function (): void {
    $bail = R::bailSigne($this->org, [
        'status' => LeaseStatus::Terminated, 'starts_on' => '2026-01-01', 'ends_on' => '2027-06-01',
        'notice_received_on' => '2026-11-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-04-01', 'termination_reason' => 'Mutation',
    ]);
    R::occuper($this->org, $bail, $this->lot, ['valid_from' => '2026-01-01', 'valid_to' => '2027-06-01']);

    $periodes = L::dans($this->org, fn (): array => app(UnitOccupations::class)->of([$this->lot->id]));

    expect(($this->occupants)('2027-03-31'))->toBe([$bail->id])
        ->and(($this->occupants)('2027-04-01'))->toBe([])
        ->and($periodes[0]['to'])->toBe('2027-04-01')
        ->and(($this->actifs)('2027-04-01', '2027-04-30'))->toBe([]);
});

it('exclut un bail archivé des baux actifs de la facturation, tout en gardant son lot occupé', function (): void {
    $archive = R::bailSigne($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'archived_at' => now()]);
    R::occuper($this->org, $archive, $this->lot, ['valid_from' => '2026-01-01']);
    $actif = R::bailSigne($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);

    expect(($this->actifs)('2026-06-01', '2026-06-30'))->toBe([$actif->id])
        ->and(($this->occupants)('2026-06-15'))->toBe([$archive->id]);
});

it('calcule la fin effective comme le plus tôt de la fin du bail et du départ annoncé', function (?string $fin, ?string $depart, ?string $attendu): void {
    $bail = new Lease;
    $bail->setAttribute('ends_on', $fin);
    $bail->setAttribute('notice_departure_on', $depart);

    expect($bail->effectiveEnd())->toBe($attendu);
})->with([
    'aucune' => [null, null, null],
    'fin seule' => ['2027-06-01', null, '2027-06-01'],
    'départ seul' => [null, '2027-04-01', '2027-04-01'],
    'départ avant la fin' => ['2027-06-01', '2027-04-01', '2027-04-01'],
    'fin avant le départ' => ['2027-03-01', '2027-04-01', '2027-03-01'],
]);
