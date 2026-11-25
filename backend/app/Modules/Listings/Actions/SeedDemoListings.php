<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final readonly class SeedDemoListings
{
    public function __construct(private CityDirectory $villes, private CurrentOrganization $contexte) {}

    /**
     * @var list<array{string, string, ListingKind, ListingCategory, string, int, int, int, list<string>, CancellationPolicy}>
     */
    private const array ANNONCES = [
        ['lyon', 'Studio lumineux au pied des pentes', ListingKind::ShortStay, ListingCategory::Studio, 'Croix-Rousse', 6500, 2, 1, ['wifi', 'kitchen', 'washer'], CancellationPolicy::Flexible],
        ['nice', 'Deux pièces avec balcon, à dix minutes de la mer', ListingKind::ShortStay, ListingCategory::Apartment, 'Libération', 11000, 4, 2, ['wifi', 'air_conditioning', 'balcony'], CancellationPolicy::Moderate],
        ['bordeaux', 'Maison de ville avec petit jardin', ListingKind::ShortStay, ListingCategory::House, 'Chartrons', 15000, 6, 3, ['wifi', 'kitchen', 'garden', 'parking'], CancellationPolicy::Strict],
        ['lille', 'Chambre dans un appartement partagé', ListingKind::LongTerm, ListingCategory::Shared, 'Wazemmes', 45000, 1, 1, ['wifi', 'heating'], CancellationPolicy::Moderate],
        ['strasbourg', 'Appartement familial près de la Petite France', ListingKind::LongTerm, ListingCategory::Apartment, 'Petite France', 98000, 5, 3, ['heating', 'elevator', 'dishwasher'], CancellationPolicy::Moderate],
        ['biarritz', 'Studio calme à deux pas des plages', ListingKind::ShortStay, ListingCategory::Studio, 'Côte des Basques', 9000, 2, 1, ['wifi', 'terrace', 'pets_allowed'], CancellationPolicy::Flexible],
    ];

    /**
     * @return int nombre d'annonces créées (les titres déjà présents sont ignorés)
     */
    public function handle(string $organizationId): int
    {
        $creees = 0;

        DB::transaction(function () use ($organizationId, &$creees): void {
            $this->contexte->run($organizationId, function () use (&$creees): void {
                foreach (self::ANNONCES as [$ville, $titre, $type, $categorie, $quartier, $prix, $capacite, $pieces, $equipements, $politique]) {
                    if (Listing::query()->where('title', $titre)->exists()) {
                        continue;
                    }

                    $commune = $this->villes->findBySlug($ville) ?? throw new RuntimeException("Commune absente du référentiel : {$ville}. Semer d'abord Geography.");

                    Listing::factory()->published()->create([
                        'city_id' => $commune->id,
                        'title' => $titre,
                        'description' => 'Annonce illustrative de démonstration, sans valeur contractuelle.',
                        'kind' => $type,
                        'category' => $categorie,
                        'price_unit' => $type->priceUnit(),
                        'neighbourhood' => $quartier,
                        'price_minor' => $prix,
                        'capacity' => $capacite,
                        'rooms' => $pieces,
                        'amenities' => $equipements,
                        'cancellation_policy' => $politique,
                        'status' => ListingStatus::Published,
                    ]);
                    $creees++;
                }
            });
        });

        return $creees;
    }
}
