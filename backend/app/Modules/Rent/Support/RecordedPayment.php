<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\ReceiptState;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;

final class RecordedPayment
{
    /**
     * @param  list<Installment>  $settled  échéances soldées par cet encaissement
     * @param  array<string, ReceiptState>  $receipts  sort de la quittance de chaque échéance soldée
     */
    public function __construct(
        public readonly Payment $payment,
        public readonly bool $replayed,
        public readonly array $settled,
        public array $receipts = [],
    ) {}
}
