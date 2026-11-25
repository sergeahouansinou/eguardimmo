<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Resources;

use App\Modules\Listings\Models\ListingLead;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ListingLead $resource
 */
final class VisitRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'status' => $this->resource->status->value,
            'requested_slot' => $this->resource->requested_slot,
            'created_at' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
