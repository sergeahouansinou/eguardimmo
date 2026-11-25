<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\ListingViews;
use App\Modules\Listings\Queries\OrganizationListings;

final class ShowListingController
{
    public function __invoke(string $listing, OrganizationListings $annonces, ListingViews $vues): ListingResource
    {
        return new ListingResource($vues->one($annonces->get($listing)));
    }
}
