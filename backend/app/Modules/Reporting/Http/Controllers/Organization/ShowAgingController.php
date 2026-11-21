<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Queries\Cards\AgingCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ShowAgingController
{
    public function __invoke(AgingCard $carte): JsonResponse
    {
        return response()->json(['data' => $carte->of(CarbonImmutable::today())]);
    }
}
