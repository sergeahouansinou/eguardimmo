<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\ReviseLeaseTerms;
use App\Modules\Leases\Http\Requests\ReviseLeaseTermsRequest;
use App\Modules\Leases\Http\Resources\LeaseTermsResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class ReviseLeaseTermsController
{
    public function __invoke(string $lease, ReviseLeaseTermsRequest $request, Leases $baux, LeaseDetails $details, ReviseLeaseTerms $reviser): LeaseTermsResource
    {
        $reviser->handle($baux->get($lease), $request->toData(), $request->user()?->id);

        $vue = $details->terms($lease);

        return (new LeaseTermsResource($vue))->additional(['meta' => ['lock_version' => $vue->lease->lock_version]]);
    }
}
