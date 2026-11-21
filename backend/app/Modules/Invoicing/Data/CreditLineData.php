<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class CreditLineData
{
    public function __construct(
        public string $lineId,
        public int $quantityMilli,
    ) {}
}
