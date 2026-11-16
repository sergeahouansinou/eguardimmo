<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Properties\Data\UnitData;

final readonly class TenancyLine
{
    public function __construct(
        public Lease $lease,
        public LeaseParty $link,
        public LeasePhase $phase,
        public ?UnitData $mainUnit,
    ) {}
}
