<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Requests\ListPropertiesRequest;
use App\Modules\Properties\Http\Resources\PropertySummaryResource;
use App\Modules\Properties\Queries\Properties;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPropertiesController
{
    public function __invoke(ListPropertiesRequest $request, Properties $properties): AnonymousResourceCollection
    {
        return PropertySummaryResource::collection($properties->list($request->filters(), $request->perPage()));
    }
}
