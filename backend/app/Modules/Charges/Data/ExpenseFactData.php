<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use Money\Money;

final readonly class ExpenseFactData
{
    /**
     * Faits d'une pièce de dépense, sans le libellé ni la pièce jointe. `kind` : `payment` ou `co_ownership_statement`.
     *
     * @param  string  $serviceFrom  Y-m-d
     * @param  string  $serviceTo  Y-m-d, exclu
     * @param  string  $status  `recorded` ou `cancelled`
     */
    public function __construct(
        public string $id,
        public string $propertyId,
        public ?string $unitId,
        public string $kind,
        public string $categoryTermId,
        public string $documentOn,
        public ?string $paidOn,
        public string $serviceFrom,
        public string $serviceTo,
        public string $settlement,
        public string $status,
        public Money $gross,
        public Money $recoverable,
        public ?string $mandantPartyId,
    ) {}
}
