<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Queries\OccupancyEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property OccupancyEntry $resource
 */
final class OccupancyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $entree = $this->resource;
        $bail = $entree->lease;

        return [
            'unit' => ApiShapes::unit($entree->unit),
            'vacant' => $bail === null,
            'since' => $entree->occupation?->valid_from->toDateString(),
            'lease' => $bail === null ? null : [
                'id' => $bail->id,
                'reference' => $bail->reference,
                'phase' => $entree->phase?->value,
                'starts_on' => $bail->starts_on->toDateString(),
                'end_date' => ApiShapes::endDate($bail->ends_on),
                'tenants' => array_map(ApiShapes::party(...), $entree->tenants),
            ],
        ];
    }
}
