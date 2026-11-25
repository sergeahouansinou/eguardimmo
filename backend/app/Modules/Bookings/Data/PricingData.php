<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

use App\Modules\Listings\Enums\CancellationPolicy;

final readonly class PricingData
{
    public function __construct(
        public int $nights,
        public int $nightlyMinor,
        public int $subtotalMinor,
        public int $serviceFeeMinor,
        public int $totalMinor,
        public string $currency,
        public CancellationPolicy $cancellationPolicy,
    ) {}
}
