<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Http\Requests\ProfitabilityRequest;
use App\Modules\Reporting\Queries\Finance\Profitability;
use App\Modules\Reporting\Support\Finance\ProfitabilityYear;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowProfitabilityController
{
    public function __invoke(ProfitabilityRequest $request, Profitability $vue): JsonResponse
    {
        $aujourdhui = CarbonImmutable::today();

        return response()->json(['data' => $vue->of(ProfitabilityYear::assert($request->year(), $aujourdhui), $aujourdhui)]);
    }
}
