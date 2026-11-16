<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\LeaseAnomalyKind;

final readonly class LeaseAnomalyData
{
    public function __construct(
        public LeaseAnomalyKind $kind,
        public string $organizationId,
        public string $leaseId,
        public string $detail,
    ) {}
}
