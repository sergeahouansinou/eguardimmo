<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Http\Requests\ListTermsRequest;
use App\Modules\Catalog\Http\Resources\TermResource;
use App\Modules\Catalog\Queries\VisibleTerms;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTermsController
{
    public function __invoke(ListTermsRequest $request, VisibleTerms $valeurs): AnonymousResourceCollection
    {
        return TermResource::collection($valeurs->resolved($request->vocabulary(), $request->includeInactive()));
    }
}
