<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class SupplierInvoiceInputData
{
    /**
     * @param  list<array{tax_rate_key: string, base: int, tax: int}>  $taxes
     */
    public function __construct(
        public string $number,
        public string $invoiceOn,
        public ?string $dueOn,
        public string $fileId,
        public array $taxes,
        public ?int $declaredGross,
        public string $idempotencyKey,
    ) {}
}
