<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Resources\LeaseBalanceResource;
use App\Modules\Rent\Queries\LeaseBalances;
use Carbon\CarbonImmutable;

final class ShowLeaseBalanceController
{
    public function __invoke(string $lease, LeaseBalances $soldes): LeaseBalanceResource
    {
        return new LeaseBalanceResource($soldes->of($lease, CarbonImmutable::today()));
    }
}
