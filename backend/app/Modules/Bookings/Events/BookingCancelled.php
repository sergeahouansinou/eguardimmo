<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class BookingCancelled implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  string  $reason  `traveler_cancelled` ou `payment_expired`
     * @param  int  $refundMinor  unités mineures de la devise de la réservation ; aucun mouvement d'argent n'en découle dans cette tranche
     */
    public function __construct(
        public string $bookingId,
        public string $organizationId,
        public string $listingId,
        public string $userId,
        public string $reason,
        public int $refundMinor,
    ) {}
}
