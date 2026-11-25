<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Events\BookingCancelled;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ExpirePendingBookings
{
    public const string REASON = 'payment_expired';

    private const int LOT = 500;

    public function __construct(
        private BookingLookup $reservations,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Libère les dates des réservations dont le délai de paiement est écoulé. Chaque réservation est relue sous verrou : une confirmation
     * arrivée entre-temps l'emporte.
     *
     * @return int nombre de réservations expirées
     */
    public function handle(CarbonImmutable $now): int
    {
        $expirees = 0;

        foreach ($this->reservations->expiredPending($now, self::LOT) as $cible) {
            $expirees += $this->contexte->run($cible['organization_id'], fn (): int => DB::transaction(function () use ($cible, $now): int {
                $reservation = $this->reservations->byId($cible['id'], true);

                if ($reservation->status !== BookingStatus::PendingPayment || $reservation->expires_at === null || $reservation->expires_at->greaterThan($now)) {
                    return 0;
                }

                $reservation->forceFill(['status' => BookingStatus::Cancelled, 'cancelled_at' => $now, 'cancel_reason' => self::REASON, 'refund_minor' => 0])->save();
                BookingCancelled::dispatch($reservation->id, $reservation->organization_id, $reservation->listing_id, $reservation->user_id, self::REASON, 0);

                return 1;
            }));
        }

        return $expirees;
    }
}
