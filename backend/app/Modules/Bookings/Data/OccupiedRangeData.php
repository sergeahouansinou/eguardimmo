<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

final readonly class OccupiedRangeData
{
    public function __construct(
        public string $checkIn,
        public string $checkOut,
    ) {}
}
