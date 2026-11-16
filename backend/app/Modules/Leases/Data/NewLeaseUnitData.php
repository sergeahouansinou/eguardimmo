<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class NewLeaseUnitData
{
    public function __construct(
        public string $unitId,
        public bool $isMain,
    ) {}
}
