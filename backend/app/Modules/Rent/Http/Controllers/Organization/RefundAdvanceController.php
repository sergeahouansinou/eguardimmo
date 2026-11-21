<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\RefundAdvance;
use App\Modules\Rent\Http\Requests\RefundAdvanceRequest;
use App\Modules\Rent\Http\Resources\AdvanceRefundResource;
use App\Modules\Rent\Http\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class RefundAdvanceController
{
    public function __invoke(string $lease, RefundAdvanceRequest $request, RefundAdvance $rembourser): JsonResponse
    {
        $cle = IdempotencyHeader::read($request);
        $aujourdhui = CarbonImmutable::today();
        $resultat = $rembourser->handle($lease, $request->amount(), CarbonImmutable::parse($request->refundedOn() ?? $aujourdhui->toDateString())->startOfDay(), $request->reference(), $cle, $aujourdhui);

        return (new AdvanceRefundResource($resultat))->response()->setStatusCode($resultat->replayed ? 200 : 201);
    }
}
