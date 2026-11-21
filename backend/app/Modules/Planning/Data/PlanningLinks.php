<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

final readonly class PlanningLinks
{
    public function __construct(
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
    ) {}
}
