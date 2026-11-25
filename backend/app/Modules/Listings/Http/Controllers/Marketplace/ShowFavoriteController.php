<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Http\Resources\ListingCardResource;
use App\Modules\Listings\Queries\Favorites;
use Illuminate\Http\Request;

final class ShowFavoriteController
{
    public function __invoke(string $ref, Request $request, Favorites $favoris): ListingCardResource
    {
        return new ListingCardResource($favoris->find((string) $request->user()?->getAuthIdentifier(), $ref));
    }
}
