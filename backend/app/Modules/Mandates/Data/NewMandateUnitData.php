<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class NewMandateUnitData
{
    public function __construct(
        public string $unitId,
        public ?string $validFrom = null,
    ) {}
}
