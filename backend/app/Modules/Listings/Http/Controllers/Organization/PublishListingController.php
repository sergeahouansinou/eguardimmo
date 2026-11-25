<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Actions\PublishListing;
use App\Modules\Listings\Http\Requests\PublishListingRequest;
use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\ListingViews;
use App\Modules\Listings\Queries\OrganizationListings;

final class PublishListingController
{
    public function __invoke(string $listing, PublishListingRequest $request, OrganizationListings $annonces, PublishListing $publier, ListingViews $vues): ListingResource
    {
        return new ListingResource($vues->one($publier->handle($annonces->get($listing), $request->lockVersion())));
    }
}
