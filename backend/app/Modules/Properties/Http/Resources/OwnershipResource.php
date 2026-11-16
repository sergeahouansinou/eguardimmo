<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Properties\Models\UnitOwnership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property UnitOwnership $resource
 */
final class OwnershipResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'unit_id' => $this->resource->unit_id,
            'party_id' => $this->resource->party_id,
            'share_bp' => $this->resource->share_bp,
            'nature' => $this->resource->nature->value,
            'valid_from' => $this->resource->valid_from->toDateString(),
            'valid_to' => $this->resource->valid_to?->toDateString(),
        ];
    }
}
