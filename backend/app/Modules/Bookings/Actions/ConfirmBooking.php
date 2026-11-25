<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Enums\ErrorCode;
use App\Modules\Bookings\Events\BookingConfirmed;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ConfirmBooking
{
    public function __construct(
        private BookingLookup $reservations,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Aucune route publique : l'action attend l'événement de paiement de Payments pour les réservations, qui n'existe pas encore.
     * Rejouable : confirmer une réservation déjà confirmée la rend telle quelle.
     */
    public function handle(string $bookingId): Booking
    {
        return DB::transaction(function () use ($bookingId): Booking {
            $reservation = $this->reservations->byId($bookingId, true);

            if ($reservation->status === BookingStatus::Confirmed) {
                return $reservation;
            }

            $maintenant = CarbonImmutable::now();

            if ($reservation->status !== BookingStatus::PendingPayment || $reservation->expires_at === null || $reservation->expires_at->lessThanOrEqualTo($maintenant)) {
                throw ErrorCode::BookingNotConfirmable->problem();
            }

            $this->contexte->run($reservation->organization_id, function () use ($reservation, $maintenant): void {
                $reservation->forceFill(['status' => BookingStatus::Confirmed, 'confirmed_at' => $maintenant, 'expires_at' => null])->save();
            });

            BookingConfirmed::dispatch($reservation->id, $reservation->organization_id, $reservation->listing_id, $reservation->user_id);

            return $reservation;
        });
    }
}
