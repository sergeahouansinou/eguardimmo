<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

use Money\Money;

final readonly class UnpaidInvoiceData
{
    /**
     * @param  string  $issuedOn  Y-m-d
     * @param  string  $dueOn  Y-m-d
     * @param  Money  $outstanding  reste dû lu au grand livre
     */
    public function __construct(
        public string $invoiceId,
        public string $number,
        public string $leaseId,
        public string $partyId,
        public string $issuedOn,
        public string $dueOn,
        public Money $total,
        public Money $outstanding,
    ) {}
}
