<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Inspections\Http\Resources\InspectionResource;
use App\Modules\Inspections\Queries\Inspections;

final class ShowInspectionController
{
    public function __invoke(string $inspection, Inspections $etats): InspectionResource
    {
        return new InspectionResource($etats->get($inspection));
    }
}
