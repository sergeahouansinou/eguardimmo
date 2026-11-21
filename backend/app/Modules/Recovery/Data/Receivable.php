<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Data;

use App\Modules\Invoicing\Data\UnpaidInvoiceData;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Rent\Data\UnpaidInstallmentData;
use Money\Money;

/**
 * Créance recouvrable, quelle que soit sa source : échéance de loyer (période) ou facture (numéro, date d'émission).
 */
final readonly class Receivable
{
    /**
     * @param  string|null  $periodStart  Y-m-d, échéance seulement
     * @param  string|null  $periodEnd  Y-m-d, échéance seulement
     * @param  string|null  $issuedOn  Y-m-d, facture seulement
     * @param  string|null  $reference  numéro de la facture
     * @param  string|null  $status  statut de l'échéance
     * @param  Money  $outstanding  reste dû lu au grand livre
     */
    public function __construct(
        public ItemType $type,
        public string $id,
        public string $leaseId,
        public ?string $partyId,
        public ?string $periodStart,
        public ?string $periodEnd,
        public ?string $issuedOn,
        public string $dueDate,
        public ?string $reference,
        public ?string $status,
        public Money $total,
        public Money $outstanding,
    ) {}

    public static function fromInstallment(UnpaidInstallmentData $e): self
    {
        return new self(ItemType::Installment, $e->installmentId, $e->leaseId, $e->partyId, $e->periodStart, $e->periodEnd, null, $e->dueDate, null, $e->status->value, $e->total, $e->outstanding);
    }

    public static function fromInvoice(UnpaidInvoiceData $f): self
    {
        return new self(ItemType::Invoice, $f->invoiceId, $f->leaseId, $f->partyId, null, null, $f->issuedOn, $f->dueOn, $f->number, null, $f->total, $f->outstanding);
    }
}
