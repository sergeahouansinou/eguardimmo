<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Http\Requests\FinancePeriodRequest;
use App\Modules\Reporting\Queries\Finance\RevenueExpenses;
use Illuminate\Http\JsonResponse;

final class ShowRevenueExpensesController
{
    public function __invoke(FinancePeriodRequest $request, RevenueExpenses $vue): JsonResponse
    {
        return response()->json(['data' => $vue->between($request->from(), $request->to())]);
    }
}
