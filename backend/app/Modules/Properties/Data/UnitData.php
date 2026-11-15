<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Catalog\Enums\UnitTypeSemantic;

final readonly class UnitData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}  $address  adresse du site
     * @param  ?UnitTypeSemantic  $unitTypeSemantic  sens système du type de lot (`residential`, `parking`…)
     */
    public function __construct(
        public string $id,
        public string $propertyId,
        public string $propertyName,
        public array $address,
        public string $reference,
        public string $unitTypeTermId,
        public string $unitTypeKey,
        public ?UnitTypeSemantic $unitTypeSemantic,
        public ?int $floor,
        public ?int $surfaceHundredths,
        public ?string $parentUnitId,
        public bool $isArchived,
    ) {}
}
