<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Support\OwnerUnitView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Un lot confié : jamais d'autre lot du même immeuble, d'identifiant de site ni de lot parent.
 *
 * @property OwnerUnitView $resource
 */
final class OwnerPropertyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lot = $this->resource->unit;

        return [
            'id' => $lot->id,
            'reference' => $lot->reference,
            'type' => $lot->unitTypeKey,
            'floor' => $lot->floor,
            'surface_hundredths' => $lot->surfaceHundredths,
            'property' => ['name' => $lot->propertyName, 'address' => $lot->address],
            'agency' => ['id' => $this->resource->organizationId, 'name' => $this->resource->agencyName],
            'mandant' => ['name' => $this->resource->visible?->mandantName],
            'covered_from' => $this->resource->coveredFrom,
            'covered_until' => $this->resource->coveredUntil,
        ];
    }
}
