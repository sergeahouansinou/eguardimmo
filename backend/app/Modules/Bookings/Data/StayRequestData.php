<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

final readonly class StayRequestData
{
    public function __construct(
        public string $listingRef,
        public string $checkIn,
        public string $checkOut,
        public int $guests,
    ) {}
}
