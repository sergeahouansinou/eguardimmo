<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Resources;

use App\Modules\Bookings\Data\QuoteData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property QuoteData $resource
 */
final class QuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource->pricing;
        $montant = fn (int $unites): array => ['amount' => $unites, 'currency' => $p->currency];

        return [
            'nights' => $p->nights,
            'nightly' => $montant($p->nightlyMinor),
            'subtotal' => $montant($p->subtotalMinor),
            'service_fee' => $montant($p->serviceFeeMinor),
            'total' => $montant($p->totalMinor),
            'cancellation_policy' => $p->cancellationPolicy->value,
            'available' => $this->resource->available,
        ];
    }
}
