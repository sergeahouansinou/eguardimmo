<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\ReorderTerms;
use App\Modules\Catalog\Http\Requests\ReorderTermsRequest;
use App\Modules\Catalog\Http\Resources\TermResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ReorderTermsController
{
    public function __invoke(ReorderTermsRequest $request, ReorderTerms $ordonner): AnonymousResourceCollection
    {
        return TermResource::collection($ordonner->handle($request->vocabulary(), $request->termIds()));
    }
}
