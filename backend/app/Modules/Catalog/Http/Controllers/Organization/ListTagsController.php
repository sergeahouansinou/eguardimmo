<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Http\Requests\ListTagsRequest;
use App\Modules\Catalog\Http\Resources\TagResource;
use App\Modules\Catalog\Queries\Tags;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTagsController
{
    public function __invoke(ListTagsRequest $request, Tags $etiquettes): AnonymousResourceCollection
    {
        return TagResource::collection($etiquettes->list($request->perPage()));
    }
}
