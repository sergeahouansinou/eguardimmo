<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Resources\PaymentResource;
use App\Modules\Rent\Queries\Payments;

final class ShowPaymentController
{
    public function __invoke(string $payment, Payments $paiements): PaymentResource
    {
        return new PaymentResource($paiements->get($payment));
    }
}
