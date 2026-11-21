<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Http\Requests\ListOrganizationPrivacyRequestsRequest;
use App\Modules\Privacy\Http\Resources\OrganizationPrivacyRequestResource;
use App\Modules\Privacy\Queries\RequestForwards;
use App\Modules\Privacy\Support\OrganizationPrivacyAdministrators;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOrganizationPrivacyRequestsController
{
    public function __invoke(ListOrganizationPrivacyRequestsRequest $requete, RequestForwards $transmissions, OrganizationPrivacyAdministrators $administrateurs): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $requete->user();
        $administrateurs->assert($user);
        $page = $transmissions->pageOfCurrentOrganization($requete->cursor(), $requete->perPage());

        return OrganizationPrivacyRequestResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]]);
    }
}
