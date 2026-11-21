<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Enums\ActivityView;
use App\Modules\Organizations\Http\Requests\ListActivityRequest;
use App\Modules\Organizations\Http\Resources\ActivityHistoryResource;
use App\Modules\Organizations\Http\Resources\ActivityRowResource;
use App\Modules\Organizations\Queries\OrganizationActivity;
use App\Modules\Organizations\Support\ActivityAccess;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListActivityController
{
    public function __invoke(ListActivityRequest $request, OrganizationActivity $journal): AnonymousResourceCollection
    {
        $vue = ActivityAccess::viewFor(OrganizationContext::member($request)->role, $request->hasEntity());
        $page = $journal->list($request->filters($request->perPage()), $vue);

        $ressource = $vue === ActivityView::History ? ActivityHistoryResource::collection($page->entries) : ActivityRowResource::collection($page->entries);

        return $ressource->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
