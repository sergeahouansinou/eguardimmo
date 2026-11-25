<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Data\OccupiedRangeData;
use App\Modules\Bookings\Queries\Availability;
use App\Modules\Listings\PublicApi\ListingDirectory;
use Carbon\CarbonImmutable;

final readonly class ListOccupiedRanges
{
    public function __construct(
        private ListingDirectory $annonces,
        private Availability $disponibilites,
    ) {}

    /**
     * @return list<OccupiedRangeData>
     */
    public function handle(string $ref, string $debut, string $fin): array
    {
        $annonce = $this->annonces->bookable($ref);

        return $this->disponibilites->occupied($annonce->id, $debut, $fin, CarbonImmutable::now());
    }
}
