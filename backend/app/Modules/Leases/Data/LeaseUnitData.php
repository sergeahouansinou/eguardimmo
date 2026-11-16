<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class LeaseUnitData
{
    public function __construct(
        public string $unitId,
        public bool $isMain,
        public string $validFrom,
        public ?string $validTo,
    ) {}
}
