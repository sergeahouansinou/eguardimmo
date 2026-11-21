<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Resources\InsuranceOverviewResource;
use App\Modules\Leases\Queries\InsuranceOverviews;
use App\Modules\Leases\Queries\Leases;

final class ShowLeaseInsuranceController
{
    public function __invoke(string $lease, Leases $baux, InsuranceOverviews $vues): InsuranceOverviewResource
    {
        return new InsuranceOverviewResource($vues->forTeam($baux->get($lease)->id));
    }
}
