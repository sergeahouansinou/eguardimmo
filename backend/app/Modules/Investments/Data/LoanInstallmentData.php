<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use Money\Money;

final readonly class LoanInstallmentData
{
    /**
     * @param  string  $dueOn  Y-m-d
     */
    public function __construct(
        public string $loanId,
        public string $propertyId,
        public ?string $unitId,
        public string $dueOn,
        public Money $payment,
        public Money $interest,
        public Money $insurance,
    ) {}
}
