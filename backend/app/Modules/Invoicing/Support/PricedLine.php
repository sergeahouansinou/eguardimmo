<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Jurisdictions\ResolvedRate;

final readonly class PricedLine
{
    public function __construct(
        public PricingLine $line,
        public ResolvedRate $rate,
        public int $net,
    ) {}
}
