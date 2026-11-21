<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\SupplierInvoice;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Journal `purchases` (ADR 0029) : la facture reçue entre en « Travaux à imputer » et en « Fournisseurs » ; l'imputation et le
 * règlement sont des écritures distinctes.
 */
final class Postings
{
    public function record(SupplierInvoice $facture, Intervention $intervention): EntryData
    {
        $montant = $facture->total_gross;

        return new EntryData(
            Journal::Purchases,
            CarbonImmutable::parse($facture->invoice_on->toDateString()),
            "Facture reçue {$facture->number}",
            SourceType::SupplierInvoice,
            $facture->id,
            "supplier_invoice:{$facture->id}:record",
            [
                LineData::debit(AccountRole::WorksPending, $montant, $intervention->lease_id, $intervention->mandant_party_id, $intervention->unit_id, ItemType::SupplierInvoice, $facture->id),
                LineData::credit(AccountRole::SupplierPayable, $montant, null, $facture->supplier_party_id, $intervention->unit_id, ItemType::SupplierInvoice, $facture->id),
            ],
        );
    }

    public function ownerAllocation(SupplierInvoice $facture, Intervention $intervention, string $allocationId, Money $part, bool $selfManaged, CarbonImmutable $jour): EntryData
    {
        return new EntryData(
            Journal::Purchases,
            $jour,
            "Imputation de la facture {$facture->number} au propriétaire",
            SourceType::SupplierAllocation,
            $allocationId,
            "supplier_allocation:{$allocationId}:allocate",
            [
                $selfManaged
                    ? LineData::debit(AccountRole::Expenses, $part, null, null, $intervention->unit_id)
                    : LineData::debit(AccountRole::OwnerPayable, $part, null, $intervention->mandant_party_id, $intervention->unit_id),
                LineData::credit(AccountRole::WorksPending, $part, $intervention->lease_id, $intervention->mandant_party_id, $intervention->unit_id, ItemType::SupplierInvoice, $facture->id),
            ],
        );
    }

    public function depositAllocation(SupplierInvoice $facture, Intervention $intervention, string $allocationId, Money $part, Money $retenue, string $leaseId, ?string $tenantPartyId, bool $selfManaged, CarbonImmutable $jour): EntryData
    {
        $reste = $part->subtract($retenue);
        $lignes = [LineData::debit(AccountRole::SecurityDeposits, $retenue, $leaseId, $tenantPartyId, $intervention->unit_id)];

        if ($reste->isPositive()) {
            $lignes[] = $selfManaged
                ? LineData::debit(AccountRole::Expenses, $reste, null, null, $intervention->unit_id)
                : LineData::debit(AccountRole::OwnerPayable, $reste, null, $intervention->mandant_party_id, $intervention->unit_id);
        }

        $lignes[] = LineData::credit(AccountRole::WorksPending, $part, $intervention->lease_id, $intervention->mandant_party_id, $intervention->unit_id, ItemType::SupplierInvoice, $facture->id);

        return new EntryData(
            Journal::Purchases,
            $jour,
            "Retenue sur dépôt de garantie, facture {$facture->number}",
            SourceType::SupplierAllocation,
            $allocationId,
            "supplier_allocation:{$allocationId}:allocate",
            $lignes,
        );
    }

    public function payment(SupplierInvoice $facture, string $paymentId, Money $montant, AccountRole $sortie, string $paidOn): EntryData
    {
        return new EntryData(
            Journal::Purchases,
            CarbonImmutable::parse($paidOn),
            "Règlement de la facture reçue {$facture->number}",
            SourceType::SupplierPayment,
            $paymentId,
            "supplier_payment:{$paymentId}:pay",
            [
                LineData::debit(AccountRole::SupplierPayable, $montant, null, $facture->supplier_party_id, null, ItemType::SupplierInvoice, $facture->id),
                LineData::credit($sortie, $montant, null, $facture->supplier_party_id),
            ],
        );
    }
}
