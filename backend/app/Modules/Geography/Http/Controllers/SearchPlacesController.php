<?php

declare(strict_types=1);

namespace App\Modules\Geography\Http\Controllers;

use App\Modules\Geography\Http\Requests\SearchPlacesRequest;
use App\Modules\Geography\Http\Resources\PlaceResource;
use App\Modules\Geography\Queries\Places;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SearchPlacesController
{
    public function __invoke(SearchPlacesRequest $request, Places $lieux): AnonymousResourceCollection
    {
        return PlaceResource::collection($lieux->search($request->term()));
    }
}
