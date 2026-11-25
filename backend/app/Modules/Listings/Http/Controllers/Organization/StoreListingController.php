<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Actions\CreateListing;
use App\Modules\Listings\Http\Requests\StoreListingRequest;
use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\ListingViews;
use Illuminate\Http\JsonResponse;

final class StoreListingController
{
    public function __invoke(StoreListingRequest $request, CreateListing $creer, ListingViews $vues): JsonResponse
    {
        return (new ListingResource($vues->one($creer->handle($request->toData()))))->response()->setStatusCode(201);
    }
}
