<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Resources;

use App\Modules\Listings\Data\ListingViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Représentation de gestion, réservée à l'organisation propriétaire de l'annonce.
 *
 * @property ListingViewData $resource
 */
final class ListingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'public_ref' => $a->ref,
            'kind' => $a->kind->value,
            'category' => $a->category->value,
            'status' => $a->status->value,
            'title' => $a->title,
            'description' => $a->description,
            'city' => $a->city === null ? null : ['slug' => $a->city->slug, 'name' => $a->city->name, 'postal_code' => $a->city->postalCode],
            'city_id' => $a->city?->id,
            'neighbourhood' => $a->neighbourhood,
            'price' => $a->priceMinor === null ? null : ['amount' => $a->priceMinor, 'currency' => $a->currency],
            'price_unit' => $a->priceUnit->value,
            'deposit' => $a->depositMinor === null ? null : ['amount' => $a->depositMinor, 'currency' => $a->currency],
            'capacity' => $a->capacity,
            'area_m2' => $a->areaM2,
            'rooms' => $a->rooms,
            'amenities' => $a->amenities,
            'min_nights' => $a->minNights,
            'cancellation_policy' => $a->cancellationPolicy->value,
            'published_at' => $a->publishedAt?->toIso8601String(),
            'missing_for_publication' => $a->missing,
            'lock_version' => $a->lockVersion,
        ];
    }
}
