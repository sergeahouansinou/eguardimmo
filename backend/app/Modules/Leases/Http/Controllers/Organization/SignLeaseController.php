<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\SignLease;
use App\Modules\Leases\Http\Requests\SignLeaseRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class SignLeaseController
{
    public function __invoke(string $lease, SignLeaseRequest $request, Leases $leases, SignLease $signer, LeaseDetails $details): LeaseResource
    {
        $bail = $signer->handle($leases->get($lease), $request->toData());

        return new LeaseResource($details->get($bail->id));
    }
}
