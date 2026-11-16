<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\UpdateLease;
use App\Modules\Leases\Http\Requests\UpdateLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class UpdateLeaseController
{
    public function __invoke(string $lease, UpdateLeaseRequest $request, Leases $baux, UpdateLease $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData())->id));
    }
}
