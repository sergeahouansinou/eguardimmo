<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Data\NewListingData;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\ListingFields;
use App\Modules\Listings\Support\PublicRef;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateListing
{
    private const int TENTATIVES = 3;

    public function __construct(private CityDirectory $villes) {}

    /**
     * Suppose le contexte d'organisation : l'annonce naît brouillon, dans l'organisation courante.
     */
    public function handle(NewListingData $donnees): Listing
    {
        $champs = ListingFields::clean($donnees->fields);

        if (isset($champs['city_id']) && $this->villes->find((string) $champs['city_id']) === null) {
            throw ErrorCode::ListingCityInvalid->problem();
        }

        for ($essai = 1; ; $essai++) {
            try {
                return DB::transaction(function () use ($champs, $donnees): Listing {
                    $annonce = new Listing;
                    $annonce->forceFill([
                        'currency' => 'EUR',
                        'min_nights' => 1,
                        'cancellation_policy' => CancellationPolicy::Moderate,
                        ...$champs,
                        'amenities' => $champs['amenities'] ?? [],
                        'kind' => $donnees->kind,
                        'category' => $donnees->category,
                        'price_unit' => $donnees->kind->priceUnit(),
                        'public_ref' => PublicRef::generate(),
                        'status' => ListingStatus::Draft,
                        'lock_version' => 1,
                    ])->save();

                    return $annonce;
                });
            } catch (UniqueConstraintViolationException $erreur) {
                if ($essai >= self::TENTATIVES) {
                    throw $erreur;
                }
            }
        }
    }
}
