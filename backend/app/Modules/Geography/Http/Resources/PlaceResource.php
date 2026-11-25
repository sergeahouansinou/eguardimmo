<?php

declare(strict_types=1);

namespace App\Modules\Geography\Http\Resources;

use App\Modules\Geography\Data\CityData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property CityData $resource
 */
final class PlaceResource extends JsonResource
{
    /**
     * @return array<string, string>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->resource->slug,
            'name' => $this->resource->name,
            'postal_code' => $this->resource->postalCode,
            'country' => $this->resource->countryCode,
        ];
    }
}
