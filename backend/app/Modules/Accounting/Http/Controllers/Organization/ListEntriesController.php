<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Controllers\Organization;

use App\Modules\Accounting\Http\Requests\ListEntriesRequest;
use App\Modules\Accounting\Http\Resources\EntryResource;
use App\Modules\Accounting\Queries\Entries;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListEntriesController
{
    public function __invoke(ListEntriesRequest $request, Entries $ecritures): AnonymousResourceCollection
    {
        return EntryResource::collection($ecritures->list($request->toData()));
    }
}
