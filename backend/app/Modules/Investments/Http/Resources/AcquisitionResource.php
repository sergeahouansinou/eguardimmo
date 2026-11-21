<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Resources;

use App\Modules\Investments\Http\Support\Shapes;
use App\Modules\Investments\Models\PropertyAcquisition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PropertyAcquisition $resource
 */
final class AcquisitionResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'property_id' => $a->property_id,
            'unit_id' => $a->unit_id,
            'acquired_on' => $a->acquired_on->toDateString(),
            'price' => Shapes::money($a->price),
            'acquisition_costs' => Shapes::money($a->acquisition_costs),
            'agency_fees' => Shapes::money($a->agency_fees),
            'initial_works' => Shapes::money($a->initial_works),
            'cost' => Shapes::money($a->total()),
            'stored_file_id' => $a->stored_file_id,
            'lock_version' => $a->lock_version,
            'created_at' => $a->created_at?->toIso8601String(),
            'updated_at' => $a->updated_at?->toIso8601String(),
        ];
    }
}
