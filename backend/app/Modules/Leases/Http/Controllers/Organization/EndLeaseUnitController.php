<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\EndLeaseUnit;
use App\Modules\Leases\Http\Requests\EndLeaseUnitRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class EndLeaseUnitController
{
    public function __invoke(string $lease, string $leaseUnit, EndLeaseUnitRequest $request, Leases $baux, EndLeaseUnit $fermer, LeaseDetails $details): LeaseResource
    {
        $bail = $fermer->handle($baux->get($lease), $leaseUnit, $request->toData());

        return new LeaseResource($details->get($bail->id));
    }
}
