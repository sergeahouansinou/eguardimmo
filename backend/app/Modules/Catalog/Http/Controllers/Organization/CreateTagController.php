<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\CreateTag;
use App\Modules\Catalog\Http\Requests\SaveTagRequest;
use App\Modules\Catalog\Http\Resources\TagResource;
use Illuminate\Http\JsonResponse;

final class CreateTagController
{
    public function __invoke(SaveTagRequest $request, CreateTag $creer): JsonResponse
    {
        return (new TagResource($creer->handle($request->name(), $request->color())))->response()->setStatusCode(201);
    }
}
