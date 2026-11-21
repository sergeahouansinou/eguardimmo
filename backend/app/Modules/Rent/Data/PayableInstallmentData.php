<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use Money\Money;

final readonly class PayableInstallmentData
{
    /**
     * @param  string  $dueDate  Y-m-d
     * @param  Money  $outstanding  reste dû lu au grand livre, strictement positif
     */
    public function __construct(
        public string $installmentId,
        public string $dueDate,
        public Money $outstanding,
    ) {}
}
