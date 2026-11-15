<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Http\Requests\ListPartiesRequest;
use App\Modules\Parties\Http\Resources\PartySummaryResource;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPartiesController
{
    public function __invoke(ListPartiesRequest $request, Parties $parties): AnonymousResourceCollection
    {
        return PartySummaryResource::collection($parties->list($request->filters(), $request->perPage()));
    }
}
