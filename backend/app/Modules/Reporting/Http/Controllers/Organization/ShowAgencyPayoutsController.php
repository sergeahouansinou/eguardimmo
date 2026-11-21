<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Queries\Cards\AgencyPayoutsCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowAgencyPayoutsController
{
    public function __invoke(AgencyPayoutsCard $carte): JsonResponse
    {
        return response()->json(['data' => $carte->of(CarbonImmutable::today())]);
    }
}
