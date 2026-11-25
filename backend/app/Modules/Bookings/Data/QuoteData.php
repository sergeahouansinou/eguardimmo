<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

final readonly class QuoteData
{
    public function __construct(
        public PricingData $pricing,
        public bool $available,
    ) {}
}
