<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Data\QuoteData;
use App\Modules\Bookings\Data\StayRequestData;
use App\Modules\Bookings\Queries\Availability;
use App\Modules\Bookings\Support\StayPricing;
use App\Modules\Listings\PublicApi\ListingDirectory;
use Carbon\CarbonImmutable;

final readonly class QuoteStay
{
    public function __construct(
        private ListingDirectory $annonces,
        private StayPricing $tarifs,
        private Availability $disponibilites,
    ) {}

    /**
     * Calcul sans écriture : même tarification que la réservation, qui la refait de toute façon côté serveur.
     */
    public function handle(StayRequestData $demande): QuoteData
    {
        $annonce = $this->annonces->bookable($demande->listingRef);
        $tarif = $this->tarifs->price($annonce, $demande->checkIn, $demande->checkOut, $demande->guests);

        return new QuoteData($tarif, ! $this->disponibilites->conflicts($annonce->id, $demande->checkIn, $demande->checkOut, CarbonImmutable::now()));
    }
}
