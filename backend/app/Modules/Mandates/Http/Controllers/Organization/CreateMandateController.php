<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\CreateMandate;
use App\Modules\Mandates\Http\Requests\CreateMandateRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\MandateViews;
use Illuminate\Http\JsonResponse;

final class CreateMandateController
{
    public function __invoke(CreateMandateRequest $request, CreateMandate $creer, MandateViews $views): JsonResponse
    {
        return (new MandateResource($views->find($creer->handle($request->toData())->id)))->response()->setStatusCode(201);
    }
}
