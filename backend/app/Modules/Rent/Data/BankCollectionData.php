<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class BankCollectionData
{
    /**
     * @param  list<string>  $settledInstallmentIds  échéances soldées par cet encaissement, dont la quittance reste à émettre
     */
    public function __construct(
        public string $paymentId,
        public string $ledgerEntryId,
        public bool $replayed,
        public array $settledInstallmentIds = [],
    ) {}
}
