<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Http\Resources\OwnerAccessStateResource;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;

final class ShowOwnerAccessController
{
    public function __invoke(string $party, Parties $parties, OwnerAccesses $acces): JsonResponse
    {
        return (new OwnerAccessStateResource($acces->stateOf($parties->get($party))))->response()->header('Cache-Control', 'no-store, private');
    }
}
