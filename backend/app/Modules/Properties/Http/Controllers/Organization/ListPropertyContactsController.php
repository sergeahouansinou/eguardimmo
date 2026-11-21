<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Requests\ListPropertyContactsRequest;
use App\Modules\Properties\Http\Resources\PropertyContactResource;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\PropertyContacts;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPropertyContactsController
{
    public function __invoke(string $property, ListPropertyContactsRequest $request, Properties $sites, PropertyContacts $contacts): AnonymousResourceCollection
    {
        $page = $contacts->ofProperty($sites->get($property)->id, $request->unitId(), $request->perPage());

        return PropertyContactResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
