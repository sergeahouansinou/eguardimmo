<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use Money\Money;

final readonly class OwnerInvoiceShareData
{
    /**
     * @param  string  $invoiceOn  Y-m-d
     * @param  Money  $ownerShare  somme des parts imputées au propriétaire, imputations annulées exclues
     */
    public function __construct(
        public string $invoiceId,
        public string $interventionId,
        public string $number,
        public string $invoiceOn,
        public ?string $propertyId,
        public ?string $unitId,
        public string $natureTermId,
        public Money $ownerShare,
    ) {}
}
