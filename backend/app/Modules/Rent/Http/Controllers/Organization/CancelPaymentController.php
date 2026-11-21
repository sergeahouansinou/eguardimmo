<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\CancelPayment;
use App\Modules\Rent\Http\Requests\ReasonRequest;
use App\Modules\Rent\Http\Resources\PaymentResource;
use App\Modules\Rent\Queries\Payments;
use Carbon\CarbonImmutable;

final class CancelPaymentController
{
    public function __invoke(string $payment, ReasonRequest $request, Payments $paiements, CancelPayment $annuler): PaymentResource
    {
        $annule = $annuler->handle($paiements->get($payment), $request->reason(), CarbonImmutable::today());

        return new PaymentResource($annule->load('allocations'));
    }
}
