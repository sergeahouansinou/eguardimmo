<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Properties\Enums\AnomalyKind;

final readonly class OwnershipAnomalyData
{
    public function __construct(
        public AnomalyKind $kind,
        public string $organizationId,
        public string $unitId,
        public string $detail,
    ) {}
}
