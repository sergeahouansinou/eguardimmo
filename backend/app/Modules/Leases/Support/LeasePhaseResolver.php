<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use Carbon\CarbonInterface;

/**
 * La phase se calcule, elle ne se stocke pas. Les dates se comparent au jour : `ends_on` est exclu. Un bail résilié à une
 * date future vit jusque-là, comme un bail signé (même définition que LeaseOccupancy).
 */
final readonly class LeasePhaseResolver
{
    public function at(Lease $bail, CarbonInterface $date): LeasePhase
    {
        $jour = $date->toDateString();

        return match ($bail->status) {
            LeaseStatus::Draft => LeasePhase::Draft,
            LeaseStatus::Cancelled => LeasePhase::Ended,
            LeaseStatus::Terminated => $bail->ends_on === null ? LeasePhase::Ended : $this->live($bail, $jour),
            LeaseStatus::Signed => $this->live($bail, $jour),
        };
    }

    private function live(Lease $bail, string $jour): LeasePhase
    {
        return match (true) {
            $bail->ends_on !== null && $jour >= $bail->ends_on->toDateString() => LeasePhase::Ended,
            $jour < $bail->starts_on->toDateString() => LeasePhase::Upcoming,
            $bail->notice_received_on !== null && $jour >= $bail->notice_received_on->toDateString() => LeasePhase::Notice,
            default => LeasePhase::Running,
        };
    }
}
