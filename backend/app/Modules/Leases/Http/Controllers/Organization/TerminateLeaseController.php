<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\TerminateLease;
use App\Modules\Leases\Http\Requests\TerminateLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class TerminateLeaseController
{
    public function __invoke(string $lease, TerminateLeaseRequest $request, Leases $baux, TerminateLease $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData())->id));
    }
}
