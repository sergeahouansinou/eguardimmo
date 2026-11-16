<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\RenewLease;
use App\Modules\Leases\Http\Requests\RenewLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class RenewLeaseController
{
    public function __invoke(string $lease, RenewLeaseRequest $request, Leases $baux, RenewLease $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData(), $request->user()?->id)->id));
    }
}
