<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Http\Resources\PublicListingResource;
use App\Modules\Listings\Queries\PublicListings;

final class ShowPublicListingController
{
    public function __invoke(string $ref, PublicListings $annonces): PublicListingResource
    {
        return new PublicListingResource($annonces->show($ref));
    }
}
