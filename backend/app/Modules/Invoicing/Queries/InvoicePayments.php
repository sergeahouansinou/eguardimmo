<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Models\InvoicePayment;
use Illuminate\Support\Str;

final readonly class InvoicePayments
{
    /**
     * Facture d'un règlement de l'organisation courante : le verrou de la facture passe avant tout le reste.
     */
    public function invoiceOf(string $paymentId): string
    {
        $reglement = Str::isUuid($paymentId) ? InvoicePayment::query()->find($paymentId, ['id', 'invoice_id']) : null;

        return ($reglement ?? throw ErrorCode::PaymentNotFound->problem())->invoice_id;
    }
}
