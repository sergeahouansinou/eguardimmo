<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Actions\UpdateListing;
use App\Modules\Listings\Http\Requests\UpdateListingRequest;
use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\ListingViews;
use App\Modules\Listings\Queries\OrganizationListings;

final class UpdateListingController
{
    public function __invoke(string $listing, UpdateListingRequest $request, OrganizationListings $annonces, UpdateListing $modifier, ListingViews $vues): ListingResource
    {
        return new ListingResource($vues->one($modifier->handle($annonces->get($listing), $request->toData())));
    }
}
