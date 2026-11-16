<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Properties\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Property $resource
 */
final class PropertySummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'type' => $this->resource->type->value,
            'address' => $this->resource->address,
            'active_units_count' => $this->resource->active_units_count ?? 0,
            'archived_at' => $this->resource->archived_at?->toIso8601String(),
        ];
    }
}
