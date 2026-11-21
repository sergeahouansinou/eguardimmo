<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Queries\Finance\Forecast;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowForecastController
{
    public function __invoke(Forecast $vue): JsonResponse
    {
        return response()->json(['data' => $vue->of(CarbonImmutable::today())]);
    }
}
