<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class InvoiceDocumentData
{
    /**
     * @param  string  $issuedOn  Y-m-d
     * @param  string  $dueOn  Y-m-d
     */
    public function __construct(
        public string $invoiceId,
        public string $number,
        public ?string $leaseId,
        public string $issuedOn,
        public string $dueOn,
        public string $issuedDocumentId,
        public string $storedFileId,
        public string $fingerprint,
    ) {}
}
