<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Enums\ErrorCode;
use App\Modules\Bookings\Events\BookingCancelled;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Modules\Bookings\Support\Calendar;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CancelBooking
{
    public const string REASON = 'traveler_cancelled';

    public function __construct(
        private BookingLookup $reservations,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Le remboursement se calcule d'après la politique figée à la réservation et n'est que constaté : aucun mouvement d'argent dans cette tranche.
     * Une réservation non payée (`pending_payment`) ne donne lieu à aucun remboursement : rien n'a été encaissé.
     */
    public function handle(string $userId, string $bookingId): Booking
    {
        return DB::transaction(function () use ($userId, $bookingId): Booking {
            $reservation = $this->reservations->owned($userId, $bookingId, true);
            $joursAvant = Calendar::daysUntil($reservation->check_in);

            if (! in_array($reservation->status, [BookingStatus::PendingPayment, BookingStatus::Confirmed], true) || $joursAvant < 1) {
                throw ErrorCode::BookingNotCancellable->problem();
            }

            $remboursement = $reservation->status === BookingStatus::Confirmed
                ? intdiv($reservation->total_minor * $reservation->cancellation_policy->refundPercent($joursAvant), 100)
                : 0;

            $this->contexte->run($reservation->organization_id, function () use ($reservation, $remboursement): void {
                $reservation->forceFill([
                    'status' => BookingStatus::Cancelled,
                    'cancelled_at' => CarbonImmutable::now(),
                    'cancel_reason' => self::REASON,
                    'refund_minor' => $remboursement,
                ])->save();
            });

            BookingCancelled::dispatch($reservation->id, $reservation->organization_id, $reservation->listing_id, $userId, self::REASON, $remboursement);

            return $reservation;
        });
    }
}
