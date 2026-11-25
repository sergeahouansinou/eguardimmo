<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Http\Requests\ListFavoritesRequest;
use App\Modules\Listings\Http\Resources\ListingCardResource;
use App\Modules\Listings\Queries\Favorites;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListFavoritesController
{
    public function __invoke(ListFavoritesRequest $request, Favorites $favoris): AnonymousResourceCollection
    {
        $page = $favoris->page((string) $request->user()?->getAuthIdentifier(), $request->perPage(), $request->cursorValue());

        return ListingCardResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
