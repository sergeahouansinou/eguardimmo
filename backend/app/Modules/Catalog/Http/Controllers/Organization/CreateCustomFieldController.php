<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\CreateCustomField;
use App\Modules\Catalog\Http\Requests\CreateCustomFieldRequest;
use App\Modules\Catalog\Http\Resources\CustomFieldResource;
use Illuminate\Http\JsonResponse;

final class CreateCustomFieldController
{
    public function __invoke(CreateCustomFieldRequest $request, CreateCustomField $creer): JsonResponse
    {
        return (new CustomFieldResource($creer->handle($request->toData())))->response()->setStatusCode(201);
    }
}
