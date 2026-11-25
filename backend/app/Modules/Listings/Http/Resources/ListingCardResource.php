<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Resources;

use App\Modules\Listings\Data\ListingViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Carte publique : ville et quartier seulement, jamais l'identifiant, l'organisation ni une coordonnée.
 *
 * @property ListingViewData $resource
 */
final class ListingCardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'ref' => $a->ref,
            'kind' => $a->kind->value,
            'category' => $a->category->value,
            'title' => $a->title,
            'city' => $a->city === null ? null : ['slug' => $a->city->slug, 'name' => $a->city->name, 'postal_code' => $a->city->postalCode],
            'neighbourhood' => $a->neighbourhood,
            'price' => ['amount' => $a->priceMinor, 'currency' => $a->currency],
            'price_unit' => $a->priceUnit->value,
            'capacity' => $a->capacity,
            'rooms' => $a->rooms,
            'area_m2' => $a->areaM2,
            'amenities' => $a->amenities,
            'min_nights' => $a->minNights,
            'host' => ['name' => $a->hostName],
        ];
    }
}
