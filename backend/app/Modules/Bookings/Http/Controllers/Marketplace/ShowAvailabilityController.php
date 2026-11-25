<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Actions\ListOccupiedRanges;
use App\Modules\Bookings\Http\Requests\AvailabilityRequest;
use App\Modules\Bookings\Http\Resources\OccupiedRangeResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ShowAvailabilityController
{
    public function __invoke(string $ref, AvailabilityRequest $request, ListOccupiedRanges $plages): AnonymousResourceCollection
    {
        return OccupiedRangeResource::collection($plages->handle($ref, $request->rangeStart(), $request->rangeEnd()));
    }
}
