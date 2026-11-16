<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;

final class ShowLeaseController
{
    public function __invoke(string $lease, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($lease));
    }
}
