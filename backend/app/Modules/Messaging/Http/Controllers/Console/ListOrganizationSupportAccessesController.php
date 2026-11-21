<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Requests\ListSupportAccessRequest;
use App\Modules\Messaging\Http\Resources\Console\OrganizationSupportAccessResource;
use App\Modules\Messaging\Queries\SupportAccessGrants;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOrganizationSupportAccessesController
{
    public function __invoke(string $organization, ListSupportAccessRequest $request, SupportAccessGrants $acces, OrganizationDirectory $annuaire): AnonymousResourceCollection
    {
        $identifiant = strtolower($organization);

        if (! array_key_exists($identifiant, $annuaire->names([$identifiant]))) {
            throw ErrorCode::OrganizationNotFound->problem();
        }

        $page = $acces->page($identifiant, $request->status(), $request->cursor(), $request->perPage());

        return OrganizationSupportAccessResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]]);
    }
}
