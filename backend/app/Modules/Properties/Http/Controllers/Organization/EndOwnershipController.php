<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\EndOwnership;
use App\Modules\Properties\Http\Requests\EndOwnershipRequest;
use App\Modules\Properties\Http\Resources\OwnershipResource;
use App\Modules\Properties\Queries\Ownerships;
use App\Modules\Properties\Queries\Units;

final class EndOwnershipController
{
    public function __invoke(string $unit, string $ownership, EndOwnershipRequest $request, Units $units, Ownerships $ownerships, EndOwnership $terminer): OwnershipResource
    {
        $lot = $units->get($unit);

        return new OwnershipResource($terminer->handle($lot, $ownerships->get($lot->id, $ownership), $request->validTo()));
    }
}
