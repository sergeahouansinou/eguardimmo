<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\AllocationTarget;

final readonly class AllocationInputData
{
    public function __construct(
        public AllocationTarget $target,
        public int $shareAmount,
        public int $wearBasisPoints,
        public ?string $basisNote,
        public string $idempotencyKey,
    ) {}
}
