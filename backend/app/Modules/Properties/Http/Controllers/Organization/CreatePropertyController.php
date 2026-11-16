<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\CreateProperty;
use App\Modules\Properties\Http\Requests\CreatePropertyRequest;
use App\Modules\Properties\Http\Resources\PropertyResource;
use App\Modules\Properties\Queries\PropertyDetails;
use Illuminate\Http\JsonResponse;

final class CreatePropertyController
{
    public function __invoke(CreatePropertyRequest $request, CreateProperty $creer, PropertyDetails $details): JsonResponse
    {
        return (new PropertyResource($details->of($creer->handle($request->toData()))))->response()->setStatusCode(201);
    }
}
