<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Http\Requests\SearchListingsRequest;
use App\Modules\Listings\Http\Resources\ListingCardResource;
use App\Modules\Listings\Queries\PublicListings;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SearchListingsController
{
    public function __invoke(SearchListingsRequest $request, PublicListings $annonces): AnonymousResourceCollection
    {
        $page = $annonces->search($request->filters());

        return ListingCardResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
