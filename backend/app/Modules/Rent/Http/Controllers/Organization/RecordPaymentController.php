<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\RecordPayment;
use App\Modules\Rent\Http\Requests\RecordPaymentRequest;
use App\Modules\Rent\Http\Resources\PaymentResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class RecordPaymentController
{
    public function __invoke(RecordPaymentRequest $request, RecordPayment $encaisser): JsonResponse
    {
        $resultat = $encaisser->handle($request->toData(), CarbonImmutable::today());
        $resultat->payment->load('allocations');

        return (new PaymentResource($resultat->payment, $resultat->receipts, $resultat->replayed))
            ->response()
            ->setStatusCode($resultat->replayed ? 200 : 201);
    }
}
