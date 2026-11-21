<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Http\Requests\ListEventsRequest;
use App\Modules\Planning\Http\Resources\OccurrenceResource;
use App\Modules\Planning\Queries\Events;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListEventsController
{
    public function __invoke(ListEventsRequest $request, Events $evenements): AnonymousResourceCollection
    {
        return OccurrenceResource::collection($evenements->occurrences($request->from(), $request->to()));
    }
}
