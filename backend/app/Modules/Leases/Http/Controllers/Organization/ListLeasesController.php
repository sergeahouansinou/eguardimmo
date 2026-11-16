<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\ListLeasesRequest;
use App\Modules\Leases\Http\Resources\LeasePageResource;
use App\Modules\Leases\Queries\LeaseList;
use App\Modules\Leases\Queries\LeaseViews;
use Carbon\CarbonImmutable;

final class ListLeasesController
{
    public function __invoke(ListLeasesRequest $request, LeaseList $list, LeaseViews $views): LeasePageResource
    {
        $today = CarbonImmutable::today();
        $page = $list->list($request->filters(), $request->perPage(), $today);

        return new LeasePageResource($page, $views->of($page->items(), $today));
    }
}
