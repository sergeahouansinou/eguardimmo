<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Requests\ListInterventionsRequest;
use App\Modules\Maintenance\Http\Resources\InterventionPageResource;
use App\Modules\Maintenance\Queries\Interventions;
use Carbon\CarbonImmutable;

final class ListInterventionsController
{
    public function __invoke(ListInterventionsRequest $request, Interventions $interventions): InterventionPageResource
    {
        $page = $interventions->page($request->filters(), CarbonImmutable::today());

        return new InterventionPageResource($page, $interventions->lookups($page->getCollection()));
    }
}
