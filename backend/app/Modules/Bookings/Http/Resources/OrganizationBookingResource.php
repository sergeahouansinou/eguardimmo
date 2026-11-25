<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Resources;

use App\Modules\Bookings\Data\BookingViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Représentation de l'hôte : le prénom du voyageur, jamais son identifiant ni ses coordonnées.
 *
 * @property BookingViewData $resource
 */
final class OrganizationBookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $b = $this->resource;
        $montant = fn (int $unites): array => ['amount' => $unites, 'currency' => $b->currency];

        return [
            'id' => $b->id,
            'reference' => $b->reference,
            'status' => $b->status->value,
            'listing' => $b->listing === null ? null : ['ref' => $b->listing->ref, 'title' => $b->listing->title],
            'traveler' => ['first_name' => $b->travelerFirstName],
            'check_in' => $b->checkIn,
            'check_out' => $b->checkOut,
            'nights' => $b->nights,
            'guests' => $b->guests,
            'subtotal' => $montant($b->subtotalMinor),
            'service_fee' => $montant($b->serviceFeeMinor),
            'total' => $montant($b->totalMinor),
            'cancelled_at' => $b->cancelledAt?->toIso8601String(),
            'cancel_reason' => $b->cancelReason,
            'refund' => $b->refundMinor === null ? null : $montant($b->refundMinor),
        ];
    }
}
