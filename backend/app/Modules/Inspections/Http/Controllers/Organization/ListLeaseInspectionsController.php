<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Inspections\Http\Requests\ListCursorRequest;
use App\Modules\Inspections\Http\Resources\InspectionResource;
use App\Modules\Inspections\Queries\Inspections;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListLeaseInspectionsController
{
    public function __invoke(string $lease, ListCursorRequest $request, LeaseDirectory $baux, Inspections $etats): AnonymousResourceCollection
    {
        return InspectionResource::collection($etats->forLease($baux->find($lease)->id, $request->perPage(), $request->cursor()));
    }
}
