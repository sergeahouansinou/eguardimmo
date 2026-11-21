<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class AddMandateUnitData
{
    public function __construct(
        public int $lockVersion,
        public string $unitId,
        public ?string $validFrom,
    ) {}
}
