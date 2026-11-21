<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use Money\Money;

final readonly class LoanCostData
{
    /**
     * @param  string  $source  `attestation` (montants attestés par la banque) ou `schedule` (échéancier et frais saisis)
     */
    public function __construct(
        public string $loanId,
        public string $propertyId,
        public ?string $unitId,
        public string $source,
        public Money $interest,
        public Money $insurance,
        public Money $fees,
    ) {}
}
