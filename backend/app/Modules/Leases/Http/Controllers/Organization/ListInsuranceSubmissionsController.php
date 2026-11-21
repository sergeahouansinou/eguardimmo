<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\ListInsuranceSubmissionsRequest;
use App\Modules\Leases\Http\Resources\InsuranceSubmissionResource;
use App\Modules\Leases\Queries\InsuranceSubmissions;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListInsuranceSubmissionsController
{
    public function __invoke(ListInsuranceSubmissionsRequest $request, InsuranceSubmissions $depots): AnonymousResourceCollection
    {
        return InsuranceSubmissionResource::collection($depots->page($request->status(), $request->perPage(), $request->cursor()));
    }
}
