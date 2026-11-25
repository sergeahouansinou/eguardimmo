<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Organization;

use App\Modules\Listings\Actions\ArchiveListing;
use App\Modules\Listings\Http\Requests\ArchiveListingRequest;
use App\Modules\Listings\Http\Resources\ListingResource;
use App\Modules\Listings\Queries\ListingViews;
use App\Modules\Listings\Queries\OrganizationListings;

final class ArchiveListingController
{
    public function __invoke(string $listing, ArchiveListingRequest $request, OrganizationListings $annonces, ArchiveListing $archiver, ListingViews $vues): ListingResource
    {
        return new ListingResource($vues->one($archiver->handle($annonces->get($listing), $request->lockVersion())));
    }
}
