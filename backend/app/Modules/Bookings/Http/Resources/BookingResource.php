<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Resources;

use App\Modules\Bookings\Data\BookingViewData;
use App\Modules\Bookings\Enums\BookingStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Représentation du voyageur. `payment` ne dit jamais « confirmée » tant que le paiement n'est pas constaté.
 *
 * @property BookingViewData $resource
 */
final class BookingResource extends JsonResource
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
            'payment' => $b->status === BookingStatus::PendingPayment ? 'to_finalize' : null,
            'listing' => $b->listing === null ? null : [
                'ref' => $b->listing->ref,
                'title' => $b->listing->title,
                'city' => $b->listing->cityName,
                'neighbourhood' => $b->listing->neighbourhood,
                'host' => ['name' => $b->listing->hostName],
            ],
            'check_in' => $b->checkIn,
            'check_out' => $b->checkOut,
            'nights' => $b->nights,
            'guests' => $b->guests,
            'nightly' => $montant($b->nightlyMinor),
            'subtotal' => $montant($b->subtotalMinor),
            'service_fee' => $montant($b->serviceFeeMinor),
            'total' => $montant($b->totalMinor),
            'cancellation_policy' => $b->cancellationPolicy->value,
            'expires_at' => $b->expiresAt?->toIso8601String(),
            'cancelled_at' => $b->cancelledAt?->toIso8601String(),
            'cancel_reason' => $b->cancelReason,
            'refund' => $b->refundMinor === null ? null : $montant($b->refundMinor),
        ];
    }
}
