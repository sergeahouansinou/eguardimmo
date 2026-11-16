<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Requests\ListOwnershipsRequest;
use App\Modules\Properties\Http\Resources\OwnershipResource;
use App\Modules\Properties\Queries\Ownerships;
use App\Modules\Properties\Queries\Units;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOwnershipsController
{
    public function __invoke(string $unit, ListOwnershipsRequest $request, Units $units, Ownerships $ownerships): AnonymousResourceCollection
    {
        return OwnershipResource::collection($ownerships->ofUnit($units->get($unit)->id, $request->at()));
    }
}
