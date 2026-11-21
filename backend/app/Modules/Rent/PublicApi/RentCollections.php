<?php

declare(strict_types=1);

namespace App\Modules\Rent\PublicApi;

use App\Modules\Rent\Actions\IssueReceiptsOf;
use App\Modules\Rent\Actions\RecordPayment;
use App\Modules\Rent\Data\BankCollectionData;
use App\Modules\Rent\Data\BankTransferData;
use App\Modules\Rent\Data\NewPaymentData;
use App\Modules\Rent\Enums\PaymentMethod;
use Carbon\CarbonImmutable;

/**
 * Encaissement d'un loyer depuis une ligne de relevé bancaire (ADR 0035) : même Action que la saisie, méthode `transfer`, dans la
 * transaction de l'appelant. Un encaissement en espèces n'est jamais pointable en banque. Suppose un contexte d'organisation.
 */
final readonly class RentCollections
{
    public function __construct(private RecordPayment $encaissement, private IssueReceiptsOf $quittances) {}

    public function recordBankTransfer(BankTransferData $transfer, CarbonImmutable $today): BankCollectionData
    {
        $resultat = $this->encaissement->handle(new NewPaymentData(
            leaseId: $transfer->leaseId,
            amount: $transfer->amount,
            method: PaymentMethod::Transfer,
            receivedOn: $transfer->receivedOn,
            reference: $transfer->reference,
            note: null,
            idempotencyKey: $transfer->idempotencyKey,
        ), $today, issueReceipts: false);

        return new BankCollectionData(
            $resultat->payment->id, (string) $resultat->payment->ledger_entry_id, $resultat->replayed,
            $resultat->replayed ? [] : array_map(static fn ($echeance): string => $echeance->id, $resultat->settled),
        );
    }

    /**
     * Quittances des échéances soldées, à émettre après la transaction de l'appelant : une panne du PDF ne défait rien et ne laisse
     * aucun fichier orphelin si cette transaction est annulée.
     *
     * @param  list<string>  $installmentIds
     */
    public function issueReceipts(array $installmentIds, CarbonImmutable $today): void
    {
        $this->quittances->handle($installmentIds, $today);
    }
}
