<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Enums\TaxCode;

final readonly class TaxGroup
{
    public function __construct(
        public TaxCode $code,
        public TaxCategory $category,
        public int $ratePcm,
        public int $base,
        public int $tax,
    ) {}
}
