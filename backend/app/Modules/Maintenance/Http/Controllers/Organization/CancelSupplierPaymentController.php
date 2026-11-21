<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CancelSupplierPayment;
use App\Modules\Maintenance\Http\Resources\PaymentResource;

final class CancelSupplierPaymentController
{
    public function __invoke(string $payment, CancelSupplierPayment $action): PaymentResource
    {
        return new PaymentResource($action->handle($payment));
    }
}
