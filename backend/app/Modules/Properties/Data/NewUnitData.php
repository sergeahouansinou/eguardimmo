<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

final readonly class NewUnitData
{
    /**
     * @param  array<string, mixed>  $characteristics
     * @param  array<string, mixed>  $customFields
     * @param  list<string>  $tagIds
     */
    public function __construct(
        public string $propertyId,
        public ?string $parentUnitId,
        public string $unitTypeTermId,
        public string $reference,
        public ?int $floor,
        public ?int $surfaceHundredths,
        public array $characteristics,
        public array $customFields,
        public array $tagIds,
    ) {}
}
