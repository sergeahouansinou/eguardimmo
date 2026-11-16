<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\DuplicateLease;
use App\Modules\Leases\Http\Requests\DuplicateLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\JsonResponse;

final class DuplicateLeaseController
{
    public function __invoke(string $lease, DuplicateLeaseRequest $request, Leases $baux, DuplicateLease $action, LeaseDetails $details): JsonResponse
    {
        return (new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData())->id)))->response()->setStatusCode(201);
    }
}
