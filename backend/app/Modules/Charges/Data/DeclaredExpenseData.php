<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use Money\Money;

final readonly class DeclaredExpenseData
{
    /**
     * @param  string  $date  Y-m-d : date de paiement, à défaut celle de la pièce
     * @param  string  $settlement  `paid_by_owner` ou `none`
     */
    public function __construct(
        public string $id,
        public string $propertyId,
        public ?string $unitId,
        public string $categoryTermId,
        public string $date,
        public string $settlement,
        public Money $amount,
        public Money $recoverableAmount,
        public ?string $mandantPartyId,
    ) {}
}
