<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\EndLeaseParty;
use App\Modules\Leases\Http\Requests\EndLeasePartyRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class EndLeasePartyController
{
    public function __invoke(string $lease, string $leaseParty, EndLeasePartyRequest $request, Leases $baux, EndLeaseParty $clore, LeaseDetails $details): LeaseResource
    {
        $clore->handle($baux->get($lease), $leaseParty, $request->toData());

        return new LeaseResource($details->get($lease));
    }
}
