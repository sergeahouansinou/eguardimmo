<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Http\Requests\MonthRequest;
use App\Modules\Reporting\Queries\Cards\LandlordCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowLandlordHomeController
{
    public function __invoke(MonthRequest $request, LandlordCard $carte): JsonResponse
    {
        return response()->json(['data' => $carte->of($request->month(), CarbonImmutable::today())]);
    }
}
