<?php

declare(strict_types=1);

namespace App\Modules\Listings\Support;

use App\Modules\Listings\Enums\Amenity;
use Illuminate\Support\Arr;

/**
 * Liste blanche des champs qu'une organisation peut écrire : jamais organization_id, status, public_ref, published_at ni lock_version.
 */
final class ListingFields
{
    public const array WRITABLE = [
        'category', 'title', 'description', 'city_id', 'neighbourhood', 'price_minor', 'currency', 'capacity', 'area_m2', 'rooms',
        'amenities', 'min_nights', 'cancellation_policy', 'deposit_minor',
    ];

    public const array CURRENCIES = ['EUR', 'XOF'];

    /**
     * @param  array<string, mixed>  $champs
     * @return array<string, mixed>
     */
    public static function clean(array $champs): array
    {
        $propres = Arr::only($champs, self::WRITABLE);

        foreach (['title', 'description', 'neighbourhood'] as $texte) {
            if (isset($propres[$texte]) && is_string($propres[$texte])) {
                $propres[$texte] = trim($propres[$texte]);
            }
        }

        if (array_key_exists('amenities', $propres)) {
            $demandes = is_array($propres['amenities']) ? $propres['amenities'] : [];
            $propres['amenities'] = array_values(array_filter(
                array_map(fn (Amenity $a): string => $a->value, Amenity::cases()),
                fn (string $valeur): bool => in_array($valeur, $demandes, true),
            ));
        }

        return $propres;
    }
}
