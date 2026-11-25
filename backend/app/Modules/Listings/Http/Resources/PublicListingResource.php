<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Resources;

use App\Modules\Listings\Data\ListingViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ListingViewData $resource
 */
final class PublicListingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            ...(new ListingCardResource($a))->toArray($request),
            'description' => $a->description,
            'deposit' => $a->depositMinor === null ? null : ['amount' => $a->depositMinor, 'currency' => $a->currency],
            'cancellation_policy' => $a->cancellationPolicy->value,
            'published_at' => $a->publishedAt?->toIso8601String(),
        ];
    }
}
