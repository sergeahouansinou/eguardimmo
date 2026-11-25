<?php

declare(strict_types=1);

namespace App\Modules\Listings\PublicApi;

use App\Modules\Listings\Data\ListingBookingData;
use App\Modules\Listings\Data\ListingSummaryData;
use App\Modules\Listings\Queries\BookableListings;

/**
 * Lecture des annonces pour Bookings ; aucun contexte d'organisation requis, aucun modèle exposé.
 */
final readonly class ListingDirectory
{
    public function __construct(private BookableListings $annonces) {}

    /**
     * Lève listing_not_found (404) si l'annonce n'est pas publiée ou n'existe pas.
     */
    public function bookable(string $ref): ListingBookingData
    {
        return $this->annonces->bookable($ref, false);
    }

    /**
     * Comme bookable(), avec un verrou de ligne tenu jusqu'à la fin de la transaction de l'appelant : il sérialise les réservations d'une même annonce.
     */
    public function lockBookable(string $ref): ListingBookingData
    {
        return $this->annonces->bookable($ref, true);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, ListingSummaryData> par identifiant d'annonce
     */
    public function summaries(array $ids): array
    {
        return $this->annonces->summaries($ids);
    }
}
