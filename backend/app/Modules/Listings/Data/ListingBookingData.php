<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingKind;

/**
 * Ce que Bookings a le droit de savoir d'une annonce publiée pour la tarifer et la réserver.
 */
final readonly class ListingBookingData
{
    public function __construct(
        public string $id,
        public string $ref,
        public string $organizationId,
        public ListingKind $kind,
        public int $priceMinor,
        public string $currency,
        public int $capacity,
        public int $minNights,
        public CancellationPolicy $cancellationPolicy,
    ) {}
}
