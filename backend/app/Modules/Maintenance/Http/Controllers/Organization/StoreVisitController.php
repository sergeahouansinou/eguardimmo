<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\ProposeVisit;
use App\Modules\Maintenance\Http\Requests\VisitRequest;
use App\Modules\Maintenance\Http\Resources\VisitResource;
use Illuminate\Http\JsonResponse;

final class StoreVisitController
{
    public function __invoke(string $intervention, VisitRequest $request, ProposeVisit $action): JsonResponse
    {
        return (new VisitResource($action->handle($intervention, $request->toData())))->response()->setStatusCode(201);
    }
}
