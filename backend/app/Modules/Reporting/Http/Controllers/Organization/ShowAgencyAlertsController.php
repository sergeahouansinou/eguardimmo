<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Queries\Cards\AgencyAlertsCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowAgencyAlertsController
{
    public function __invoke(AgencyAlertsCard $carte): JsonResponse
    {
        return response()->json(['data' => $carte->of(CarbonImmutable::today())]);
    }
}
