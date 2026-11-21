<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class AdjustmentCreditData
{
    public function __construct(
        public string $paymentId,
        public string $ledgerEntryId,
        public bool $replayed,
    ) {}
}
