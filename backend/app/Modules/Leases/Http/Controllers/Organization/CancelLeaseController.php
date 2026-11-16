<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\CancelLease;
use App\Modules\Leases\Http\Requests\CancelLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class CancelLeaseController
{
    public function __invoke(string $lease, CancelLeaseRequest $request, Leases $baux, CancelLease $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData())->id));
    }
}
