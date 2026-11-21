<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class PlacementData
{
    public function __construct(
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $mandateId,
        public ?string $mandantPartyId,
        public ?int $ceiling,
        public ?string $currency,
        public bool $suspended,
    ) {}
}
