<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\AddOwnership;
use App\Modules\Properties\Http\Requests\AddOwnershipRequest;
use App\Modules\Properties\Http\Resources\OwnershipResource;
use App\Modules\Properties\Queries\Units;
use Illuminate\Http\JsonResponse;

final class AddOwnershipController
{
    public function __invoke(string $unit, AddOwnershipRequest $request, Units $units, AddOwnership $ajouter): JsonResponse
    {
        return (new OwnershipResource($ajouter->handle($units->get($unit), $request->toData())))->response()->setStatusCode(201);
    }
}
