<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\PublicApi;

use App\Modules\Invoicing\Actions\RecordInvoicePayment;
use App\Modules\Invoicing\Data\BankInvoiceTransferData;
use App\Modules\Invoicing\Data\BankSettlementData;
use App\Modules\Invoicing\Data\NewPaymentData;
use App\Modules\Invoicing\Enums\PaymentMethod;
use Carbon\CarbonImmutable;

/**
 * Règlement d'une facture depuis une ligne de relevé bancaire (ADR 0035), dans la transaction de l'appelant : même Action que la saisie,
 * plafonné au reste dû (ADR 0028), reporté sur le premier jour ouvert si le mois est clos. Suppose un contexte d'organisation.
 */
final readonly class InvoiceSettlements
{
    public function __construct(private RecordInvoicePayment $reglement) {}

    public function recordBankTransfer(BankInvoiceTransferData $transfer, CarbonImmutable $today): BankSettlementData
    {
        $resultat = $this->reglement->handle($transfer->invoiceId, new NewPaymentData(
            amount: $transfer->amount,
            method: PaymentMethod::Transfer,
            paidOn: $transfer->paidOn,
            reference: $transfer->reference,
            idempotencyKey: $transfer->idempotencyKey,
        ), $today, rollForward: true);

        return new BankSettlementData($resultat['payment']->id, (string) $resultat['payment']->ledger_entry_id, $resultat['replayed']);
    }
}
