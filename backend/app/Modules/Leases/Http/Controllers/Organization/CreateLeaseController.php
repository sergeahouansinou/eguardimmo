<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\CreateLease;
use App\Modules\Leases\Http\Requests\CreateLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use Illuminate\Http\JsonResponse;

final class CreateLeaseController
{
    public function __invoke(CreateLeaseRequest $request, CreateLease $creer, LeaseDetails $details): JsonResponse
    {
        return (new LeaseResource($details->get($creer->handle($request->toData())->id)))->response()->setStatusCode(201);
    }
}
