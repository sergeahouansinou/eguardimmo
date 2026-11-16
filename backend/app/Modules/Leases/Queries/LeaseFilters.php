<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePhase;

final readonly class LeaseFilters
{
    public function __construct(
        public ?LeasePhase $phase = null,
        public ?string $unitId = null,
        public ?string $partyId = null,
        public bool $archived = false,
        public ?string $search = null,
        public ?string $cursor = null,
    ) {}
}
