<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Resources;

use App\Modules\Bookings\Data\OccupiedRangeData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Une plage occupée, rien d'autre : départ exclusif, aucune identité.
 *
 * @property OccupiedRangeData $resource
 */
final class OccupiedRangeResource extends JsonResource
{
    /**
     * @return array<string, string>
     */
    public function toArray(Request $request): array
    {
        return ['check_in' => $this->resource->checkIn, 'check_out' => $this->resource->checkOut];
    }
}
