<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\ListCursorRequest;
use App\Modules\Leases\Http\Resources\LeaseDocumentResource;
use App\Modules\Leases\Queries\LeaseDocuments;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListLeaseDocumentsController
{
    public function __invoke(string $lease, ListCursorRequest $request, Leases $baux, LeaseDocuments $documents): AnonymousResourceCollection
    {
        return LeaseDocumentResource::collection($documents->page($baux->get($lease)->id, $request->perPage(), $request->cursor()));
    }
}
