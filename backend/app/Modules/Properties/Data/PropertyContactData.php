<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Catalog\Data\TermData;
use Carbon\CarbonInterface;

final readonly class PropertyContactData
{
    public function __construct(
        public string $id,
        public string $propertyId,
        public ?string $unitId,
        public string $partyId,
        public string $partyName,
        public string $partyKind,
        public bool $partyAnonymized,
        public ?TermData $category,
        public CarbonInterface $createdAt,
        public ?string $propertyName = null,
        public ?string $unitReference = null,
    ) {}
}
