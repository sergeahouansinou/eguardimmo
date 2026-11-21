<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class FeeInvoiceData
{
    public function __construct(
        public string $invoiceId,
        public string $number,
        public int $netMinor,
        public int $taxMinor,
        public int $grossMinor,
        public int $outstandingMinor,
        public bool $replayed,
    ) {}
}
