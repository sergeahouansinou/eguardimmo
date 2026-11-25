<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Http\Requests\ListOrganizationListingsRequest;
use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\OrganizationListings;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListListingsController
{
    public function __invoke(ListOrganizationListingsRequest $request, OrganizationListings $annonces): AnonymousResourceCollection
    {
        $page = $annonces->page($request->status(), $request->perPage(), $request->cursorValue());

        return ListingResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
