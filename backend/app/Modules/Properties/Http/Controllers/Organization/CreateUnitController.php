<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\CreateUnit;
use App\Modules\Properties\Http\Requests\CreateUnitRequest;
use App\Modules\Properties\Http\Resources\UnitResource;
use App\Modules\Properties\Queries\UnitDetails;
use Illuminate\Http\JsonResponse;

final class CreateUnitController
{
    public function __invoke(CreateUnitRequest $request, CreateUnit $creer, UnitDetails $details): JsonResponse
    {
        return (new UnitResource($details->of($creer->handle($request->toData()))))->response()->setStatusCode(201);
    }
}
