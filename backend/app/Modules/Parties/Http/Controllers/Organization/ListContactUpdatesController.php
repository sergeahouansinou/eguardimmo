<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Http\Requests\ListCursorRequest;
use App\Modules\Parties\Http\Resources\ContactUpdateResource;
use App\Modules\Parties\Queries\ContactUpdates;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListContactUpdatesController
{
    public function __invoke(string $party, ListCursorRequest $request, ContactUpdates $demandes): AnonymousResourceCollection
    {
        return ContactUpdateResource::collection($demandes->ofParty($party, $request->perPage(), $request->cursor()));
    }
}
