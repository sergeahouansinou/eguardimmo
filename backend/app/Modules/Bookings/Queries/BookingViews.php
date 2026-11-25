<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Queries;

use App\Modules\Bookings\Data\BookingViewData;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Listings\PublicApi\ListingDirectory;
use Carbon\CarbonImmutable;

final readonly class BookingViews
{
    public function __construct(private ListingDirectory $annonces) {}

    /**
     * @param  list<Booking>  $reservations
     * @return list<BookingViewData>
     */
    public function many(array $reservations, bool $withTraveler): array
    {
        $annonces = $this->annonces->summaries(array_values(array_unique(array_map(fn (Booking $b): string => $b->listing_id, $reservations))));
        $prenoms = $withTraveler ? $this->firstNames(array_values(array_unique(array_map(fn (Booking $b): string => $b->user_id, $reservations)))) : [];

        return array_map(fn (Booking $b): BookingViewData => new BookingViewData(
            id: $b->id,
            reference: $b->reference,
            listing: $annonces[$b->listing_id] ?? null,
            checkIn: $b->check_in,
            checkOut: $b->check_out,
            nights: $b->nights,
            guests: $b->guests,
            nightlyMinor: $b->nightly_minor,
            subtotalMinor: $b->subtotal_minor,
            serviceFeeMinor: $b->service_fee_minor,
            totalMinor: $b->total_minor,
            currency: $b->currency,
            cancellationPolicy: $b->cancellation_policy,
            status: $b->status,
            expiresAt: $b->expires_at === null ? null : CarbonImmutable::instance($b->expires_at),
            confirmedAt: $b->confirmed_at === null ? null : CarbonImmutable::instance($b->confirmed_at),
            cancelledAt: $b->cancelled_at === null ? null : CarbonImmutable::instance($b->cancelled_at),
            cancelReason: $b->cancel_reason,
            refundMinor: $b->refund_minor,
            travelerFirstName: $prenoms[$b->user_id] ?? null,
        ), $reservations);
    }

    public function one(Booking $reservation, bool $withTraveler = false): BookingViewData
    {
        return $this->many([$reservation], $withTraveler)[0];
    }

    /**
     * L'hôte voit le prénom du voyageur, rien d'autre de son compte.
     *
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function firstNames(array $ids): array
    {
        $prenoms = [];

        foreach (User::query()->withTrashed()->whereIn('id', $ids)->pluck('name', 'id') as $id => $nom) {
            $prenoms[(string) $id] = explode(' ', trim((string) $nom))[0];
        }

        return $prenoms;
    }
}
