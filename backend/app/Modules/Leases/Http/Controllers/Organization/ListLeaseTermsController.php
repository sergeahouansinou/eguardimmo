<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Resources\LeaseTermsResource;
use App\Modules\Leases\Queries\LeaseDetails;

final class ListLeaseTermsController
{
    public function __invoke(string $lease, LeaseDetails $details): LeaseTermsResource
    {
        return new LeaseTermsResource($details->terms($lease));
    }
}
