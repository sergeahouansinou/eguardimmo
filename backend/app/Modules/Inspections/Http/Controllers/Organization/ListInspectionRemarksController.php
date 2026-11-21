<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Inspections\Http\Requests\ListCursorRequest;
use App\Modules\Inspections\Http\Resources\InspectionRemarkResource;
use App\Modules\Inspections\Queries\Inspections;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListInspectionRemarksController
{
    public function __invoke(string $inspection, ListCursorRequest $request, Inspections $etats): AnonymousResourceCollection
    {
        return InspectionRemarkResource::collection($etats->remarks($etats->get($inspection), $request->perPage(), $request->cursor()));
    }
}
