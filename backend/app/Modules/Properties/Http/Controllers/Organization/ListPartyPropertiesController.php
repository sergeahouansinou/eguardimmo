<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Http\Requests\ListPartyPropertiesRequest;
use App\Modules\Properties\Http\Resources\PropertyContactResource;
use App\Modules\Properties\Queries\PropertyContacts;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPartyPropertiesController
{
    public function __invoke(ListPartyPropertiesRequest $request, PartyDirectory $parties, PropertyContacts $contacts): AnonymousResourceCollection
    {
        $page = $contacts->ofParty($parties->find($request->partyId())->id, $request->perPage());

        return PropertyContactResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
