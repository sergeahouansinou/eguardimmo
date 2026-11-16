<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\ListRegimesRequest;
use App\Modules\Leases\Http\Resources\RegimeResource;
use App\Modules\Leases\Queries\AvailableRegimes;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListRegimesController
{
    public function __invoke(ListRegimesRequest $request, AvailableRegimes $regimes): AnonymousResourceCollection
    {
        return RegimeResource::collection($regimes->forUnit($request->unitId()));
    }
}
