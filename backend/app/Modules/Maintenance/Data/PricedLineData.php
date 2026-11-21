<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\TaxCategory;

final readonly class PricedLineData
{
    public function __construct(
        public int $position,
        public string $label,
        public int $quantityMilli,
        public ?string $unit,
        public int $unitPrice,
        public int $net,
        public TaxCategory $category,
        public int $ratePcm,
    ) {}
}
