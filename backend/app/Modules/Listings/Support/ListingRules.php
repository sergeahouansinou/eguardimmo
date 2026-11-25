<?php

declare(strict_types=1);

namespace App\Modules\Listings\Support;

use App\Modules\Listings\Enums\Amenity;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use Illuminate\Validation\Rule;

final class ListingRules
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function fields(bool $creation): array
    {
        $presence = $creation ? ['required'] : ['sometimes'];

        return [
            ...($creation ? ['kind' => ['required', Rule::enum(ListingKind::class)]] : []),
            'category' => [...$presence, Rule::enum(ListingCategory::class)],
            'title' => PlainText::line(120),
            'description' => PlainText::text(4000),
            'city_id' => ['nullable', 'uuid'],
            'neighbourhood' => PlainText::line(80),
            'price_minor' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'currency' => ['sometimes', Rule::in(ListingFields::CURRENCIES)],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:50'],
            'area_m2' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'rooms' => ['nullable', 'integer', 'min:1', 'max:50'],
            'amenities' => ['nullable', 'array', 'max:'.count(Amenity::cases())],
            'amenities.*' => ['string', 'distinct', Rule::enum(Amenity::class)],
            'min_nights' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'cancellation_policy' => ['sometimes', Rule::enum(CancellationPolicy::class)],
            'deposit_minor' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ];
    }
}
