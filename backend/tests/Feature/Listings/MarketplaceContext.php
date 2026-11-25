<?php

declare(strict_types=1);

namespace Tests\Feature\Listings;

use App\Modules\Geography\Models\City;
use App\Modules\Geography\PublicApi\GeographyCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Organizations\Models\Organization;
use Tests\Feature\Properties\PropertiesContext as C;

final class MarketplaceContext
{
    public static function semer(): void
    {
        C::semer();
        app(GeographyCatalog::class)->seed();
    }

    public static function ville(string $slug = 'lyon'): City
    {
        return City::query()->where('slug', $slug)->firstOrFail();
    }

    public static function voyageur(): User
    {
        return User::factory()->create();
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function annonce(Organization $organisation, array $attributs = [], ListingStatus $statut = ListingStatus::Published): Listing
    {
        return C::dans($organisation, fn (): Listing => Listing::factory()->create([
            'city_id' => self::ville()->id,
            'status' => $statut,
            'published_at' => $statut === ListingStatus::Draft ? null : now(),
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $corps
     * @return array<string, mixed>
     */
    public static function corpsAnnonce(array $corps = []): array
    {
        return [
            'kind' => 'short_stay',
            'category' => 'apartment',
            'title' => 'Appartement près de la Saône',
            'description' => 'Calme, lumineux, proche des transports.',
            'city_id' => self::ville()->id,
            'neighbourhood' => 'Vaise',
            'price_minor' => 8500,
            'capacity' => 4,
            'rooms' => 2,
            'area_m2' => 42,
            'amenities' => ['wifi', 'kitchen'],
            'min_nights' => 2,
            'cancellation_policy' => 'moderate',
            ...$corps,
        ];
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return C::url($organisation, "/listings{$chemin}");
    }
}
