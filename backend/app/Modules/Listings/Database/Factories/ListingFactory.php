<?php

declare(strict_types=1);

namespace App\Modules\Listings\Database\Factories;

use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Enums\PriceUnit;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\PublicRef;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Listing>
 */
final class ListingFactory extends Factory
{
    protected $model = Listing::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'public_ref' => PublicRef::generate(),
            'kind' => ListingKind::ShortStay,
            'category' => ListingCategory::Apartment,
            'title' => 'Appartement lumineux',
            'description' => 'Un appartement calme, proche des commerces.',
            'price_minor' => 9000,
            'currency' => 'EUR',
            'price_unit' => PriceUnit::Night,
            'capacity' => 4,
            'rooms' => 2,
            'area_m2' => 45,
            'amenities' => ['wifi', 'kitchen'],
            'min_nights' => 1,
            'cancellation_policy' => CancellationPolicy::Moderate,
            'status' => ListingStatus::Draft,
            'lock_version' => 1,
        ];
    }

    public function published(): self
    {
        return $this->state(fn (): array => ['status' => ListingStatus::Published, 'published_at' => now()]);
    }
}
