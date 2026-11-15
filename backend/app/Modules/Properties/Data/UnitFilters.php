<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

final readonly class UnitFilters
{
    public function __construct(
        public ?string $search = null,
        public ?string $propertyId = null,
        public ?string $unitTypeTermId = null,
        public ?string $parentUnitId = null,
        public bool $rootOnly = false,
        public string $status = 'active',
    ) {}
}
