<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class BankInvoiceTransferData
{
    /**
     * @param  int  $amount  unités mineures de la devise de la facture : la devise ne vient jamais de l'appelant
     * @param  string  $paidOn  Y-m-d, date de comptabilisation de la ligne de relevé
     */
    public function __construct(
        public string $invoiceId,
        public int $amount,
        public string $paidOn,
        public ?string $reference,
        public string $idempotencyKey,
    ) {}
}
