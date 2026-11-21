<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\CloseAccountingMonth;
use App\Modules\OwnerFunds\Http\Requests\CloseMonthRequest;
use App\Modules\OwnerFunds\Http\Resources\ClosedPeriodResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class CloseMonthController
{
    public function __invoke(CloseMonthRequest $request, CloseAccountingMonth $cloture): JsonResponse
    {
        $resultat = $cloture->handle($request->month(), IdempotencyHeader::read($request), Actor::id($request), CarbonImmutable::today());

        return response()->json(['data' => (new ClosedPeriodResource($resultat['period']))->resolve(), 'warnings' => $resultat['warnings']], $resultat['replayed'] ? 200 : 201);
    }
}
