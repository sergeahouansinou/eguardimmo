<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Http\Requests\ListTasksRequest;
use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTasksController
{
    public function __invoke(ListTasksRequest $request, Tasks $taches): AnonymousResourceCollection
    {
        $page = $taches->page($request->filters((string) $request->user()?->getAuthIdentifier()));

        return TaskResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}
