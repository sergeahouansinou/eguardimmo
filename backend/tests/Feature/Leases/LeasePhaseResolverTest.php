<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\LeasePhaseResolver;
use Carbon\CarbonImmutable;

function leasePhase(array $attributs, string $jour): LeasePhase
{
    $bail = Lease::factory()->make([
        'status' => LeaseStatus::Signed,
        'signed_on' => '2025-12-15',
        'starts_on' => '2026-03-01',
        'ends_on' => '2027-03-01',
        ...$attributs,
    ]);

    return app(LeasePhaseResolver::class)->at($bail, CarbonImmutable::parse($jour));
}

it('donne la phase d\'un bail selon son statut et la date', function (array $attributs, string $jour, LeasePhase $attendue): void {
    expect(leasePhase($attributs, $jour))->toBe($attendue);
})->with([
    'brouillon, même daté dans le passé' => [['status' => LeaseStatus::Draft, 'signed_on' => null], '2026-06-01', LeasePhase::Draft],
    'signé, début futur' => [[], '2026-02-28', LeasePhase::Upcoming],
    'signé, le jour du début' => [[], '2026-03-01', LeasePhase::Running],
    'signé, en cours' => [[], '2026-09-15', LeasePhase::Running],
    'dernier jour avant la fin exclue' => [[], '2027-02-28', LeasePhase::Running],
    'le jour de la fin exclue' => [[], '2027-03-01', LeasePhase::Ended],
    'après la fin' => [[], '2028-01-01', LeasePhase::Ended],
    'sans date de fin' => [['ends_on' => null], '2040-01-01', LeasePhase::Running],
    'préavis enregistré, la veille de sa réception' => [['notice_received_on' => '2026-09-10', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-12-10', 'termination_reason' => 'départ'], '2026-09-09', LeasePhase::Running],
    'préavis enregistré, le jour de sa réception' => [['notice_received_on' => '2026-09-10', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-12-10', 'termination_reason' => 'départ'], '2026-09-10', LeasePhase::Notice],
    'préavis puis fin atteinte' => [['ends_on' => '2026-12-10', 'notice_received_on' => '2026-09-10'], '2026-12-10', LeasePhase::Ended],
    'résilié à une date future : il vit jusque-là' => [['status' => LeaseStatus::Terminated], '2026-09-15', LeasePhase::Running],
    'résilié, la veille de la fin' => [['status' => LeaseStatus::Terminated], '2027-02-28', LeasePhase::Running],
    'résilié, le jour de la fin exclue' => [['status' => LeaseStatus::Terminated], '2027-03-01', LeasePhase::Ended],
    'résilié avec préavis reçu, avant la fin' => [['status' => LeaseStatus::Terminated, 'notice_received_on' => '2026-09-10'], '2026-09-15', LeasePhase::Notice],
    'résilié sans fin connue' => [['status' => LeaseStatus::Terminated, 'ends_on' => null], '2026-09-15', LeasePhase::Ended],
    'annulé' => [['status' => LeaseStatus::Cancelled], '2026-02-01', LeasePhase::Ended],
    'bail pas encore commencé mais résilié à une date future' => [['status' => LeaseStatus::Terminated], '2026-01-01', LeasePhase::Upcoming],
]);

it('ignore l\'heure de la date fournie', function (): void {
    expect(leasePhase([], '2027-02-28 23:59:59'))->toBe(LeasePhase::Running)
        ->and(leasePhase([], '2027-03-01 00:00:00'))->toBe(LeasePhase::Ended);
});
