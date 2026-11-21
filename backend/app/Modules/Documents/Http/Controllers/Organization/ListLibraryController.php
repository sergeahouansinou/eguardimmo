<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Http\Requests\ListLibraryRequest;
use App\Modules\Documents\Http\Resources\LibraryDocumentResource;
use App\Modules\Documents\Queries\LibraryEntries;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListLibraryController
{
    public function __invoke(ListLibraryRequest $request, LibraryEntries $entrees): AnonymousResourceCollection
    {
        return LibraryDocumentResource::collection($entrees->page($request->filters(), $request->perPage(), $request->cursor()));
    }
}
