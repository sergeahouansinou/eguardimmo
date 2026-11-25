<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class BookingCreated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $bookingId,
        public string $organizationId,
        public string $listingId,
        public string $userId,
    ) {}
}
