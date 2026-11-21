<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\CancelInvoicePayment;
use App\Modules\Invoicing\Http\Resources\InvoicePaymentResource;
use App\Modules\Invoicing\Queries\InvoicePayments;
use Carbon\CarbonImmutable;

final class CancelInvoicePaymentController
{
    public function __invoke(string $payment, InvoicePayments $reglements, CancelInvoicePayment $annuler): InvoicePaymentResource
    {
        return new InvoicePaymentResource($annuler->handle($reglements->invoiceOf($payment), $payment, CarbonImmutable::today()));
    }
}
