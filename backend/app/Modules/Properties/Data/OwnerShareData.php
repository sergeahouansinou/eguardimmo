<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Properties\Enums\OwnershipNature;

final readonly class OwnerShareData
{
    public function __construct(
        public string $partyId,
        public int $shareBp,
        public OwnershipNature $nature,
        public string $validFrom,
        public ?string $validTo,
    ) {}
}
