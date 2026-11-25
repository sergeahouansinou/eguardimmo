<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Data\ListingBookingData;
use App\Modules\Listings\Data\ListingSummaryData;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\PublicRef;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\AcrossOrganizations;

/**
 * Ce que Bookings lit des annonces, par la PublicApi, sans jamais recevoir de modèle.
 */
final readonly class BookableListings
{
    public function __construct(
        private CityDirectory $villes,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * Pose le verrou de ligne de l'annonce : à appeler dans la transaction qui crée la réservation.
     */
    public function bookable(string $ref, bool $verrou): ListingBookingData
    {
        $requete = AcrossOrganizations::query(Listing::class)->where('status', ListingStatus::Published->value);

        if ($verrou) {
            $requete->lockForUpdate();
        }

        $annonce = (PublicRef::isValid($ref) ? $requete->where('public_ref', $ref)->first() : null) ?? throw ErrorCode::ListingNotFound->problem();

        if ($annonce->price_minor === null || $annonce->capacity === null) {
            throw ErrorCode::ListingNotFound->problem();
        }

        return new ListingBookingData($annonce->id, $annonce->public_ref, $annonce->organization_id, $annonce->kind, $annonce->price_minor, $annonce->currency, $annonce->capacity, $annonce->min_nights, $annonce->cancellation_policy);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, ListingSummaryData> par identifiant d'annonce, quel que soit son statut
     */
    public function summaries(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $annonces = AcrossOrganizations::query(Listing::class)->whereIn('id', $ids)->get();
        $villes = $this->villes->findMany(array_values(array_unique(array_filter($annonces->map(fn (Listing $a): ?string => $a->city_id)->all()))));
        $hotes = $this->organisations->names(array_values(array_unique($annonces->map(fn (Listing $a): string => $a->organization_id)->all())));
        $resultat = [];

        foreach ($annonces as $annonce) {
            $resultat[$annonce->id] = new ListingSummaryData(
                $annonce->id,
                $annonce->public_ref,
                (string) $annonce->title,
                $annonce->city_id === null ? null : ($villes[$annonce->city_id]->name ?? null),
                $annonce->neighbourhood,
                $hotes[$annonce->organization_id] ?? null,
            );
        }

        return $resultat;
    }
}
