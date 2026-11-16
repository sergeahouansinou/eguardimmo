<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Queries\TenancyEntry;
use App\Modules\Leases\Queries\TenancyLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TenancyEntry $resource
 */
final class TenancyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'party' => ApiShapes::party($this->resource->party),
            'leases' => array_map(fn (TenancyLine $ligne): array => [
                'id' => $ligne->lease->id,
                'reference' => $ligne->lease->reference,
                'role' => $ligne->link->role->value,
                'phase' => $ligne->phase->value,
                'main_unit' => $ligne->mainUnit === null ? null : ApiShapes::unit($ligne->mainUnit),
                'since' => $ligne->link->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->link->valid_to),
            ], $this->resource->leases),
        ];
    }
}
