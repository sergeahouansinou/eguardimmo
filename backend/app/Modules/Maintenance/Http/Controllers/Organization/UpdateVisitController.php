<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\UpdateVisit;
use App\Modules\Maintenance\Http\Requests\VisitRequest;
use App\Modules\Maintenance\Http\Resources\VisitResource;

final class UpdateVisitController
{
    public function __invoke(string $intervention, string $visit, VisitRequest $request, UpdateVisit $action): VisitResource
    {
        return new VisitResource($action->handle($intervention, $visit, $request->toData()));
    }
}
