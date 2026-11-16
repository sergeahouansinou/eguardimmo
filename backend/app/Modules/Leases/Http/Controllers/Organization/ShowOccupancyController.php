<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\OccupancyRequest;
use App\Modules\Leases\Http\Resources\OccupancyResource;
use App\Modules\Leases\Queries\Occupancy;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ShowOccupancyController
{
    public function __invoke(OccupancyRequest $request, Occupancy $occupancy): AnonymousResourceCollection
    {
        return OccupancyResource::collection($occupancy->at($request->unitIds(), $request->day()));
    }
}
