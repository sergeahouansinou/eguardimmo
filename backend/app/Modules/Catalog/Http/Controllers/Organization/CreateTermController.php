<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\CreateTerm;
use App\Modules\Catalog\Http\Requests\CreateTermRequest;
use App\Modules\Catalog\Http\Resources\TermResource;
use Illuminate\Http\JsonResponse;

final class CreateTermController
{
    public function __invoke(CreateTermRequest $request, CreateTerm $creer): JsonResponse
    {
        return (new TermResource($creer->handle($request->vocabulary(), $request->toData())))->response()->setStatusCode(201);
    }
}
