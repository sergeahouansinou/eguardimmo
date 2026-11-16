<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Properties\Data\UnitData;

final readonly class OccupancyEntry
{
    /**
     * @param  list<PartyData>  $tenants
     */
    public function __construct(
        public UnitData $unit,
        public ?Lease $lease = null,
        public ?LeaseUnit $occupation = null,
        public ?LeasePhase $phase = null,
        public array $tenants = [],
    ) {}
}
