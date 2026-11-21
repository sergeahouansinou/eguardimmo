<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class BankSettlementData
{
    public function __construct(
        public string $paymentId,
        public string $ledgerEntryId,
        public bool $replayed,
    ) {}
}
