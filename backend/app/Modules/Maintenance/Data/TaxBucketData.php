<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\TaxCategory;

final readonly class TaxBucketData
{
    public function __construct(
        public TaxCategory $category,
        public int $ratePcm,
        public int $base,
        public int $tax,
    ) {}
}
