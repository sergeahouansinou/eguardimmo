<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Models\SupplierPayment;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CancelSupplierInvoice
{
    public function __construct(
        private Locks $verrous,
        private Ledger $livre,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Une facture ne s'annule que sans imputation ni règlement actifs : l'écriture d'entrée est contrepassée.
     */
    public function handle(string $interventionId, string $invoiceId): SupplierInvoice
    {
        return DB::transaction(function () use ($interventionId, $invoiceId): SupplierInvoice {
            $intervention = $this->verrous->intervention($interventionId);
            $facture = $this->verrous->invoice($invoiceId, $interventionId);

            if ($facture->status === SupplierInvoiceStatus::Cancelled) {
                return $facture;
            }

            if ($intervention->status->isTerminal()
                || InvoiceAllocation::query()->where('supplier_invoice_id', $facture->id)->whereNull('cancelled_at')->exists()
                || SupplierPayment::query()->where('supplier_invoice_id', $facture->id)->whereNull('cancelled_at')->exists()) {
                throw ErrorCode::InvoiceStatusInvalid->problem();
            }

            $this->livre->reverse($facture->ledger_entry_id, CarbonImmutable::today());
            $facture->forceFill(['status' => SupplierInvoiceStatus::Cancelled, 'lock_version' => $facture->lock_version + 1])->save();
            $this->chronologie->add($intervention, EventKind::Updated, ActorKind::Team, 'Facture reçue annulée.', metadata: ['invoice_id' => $facture->id]);
            $this->audit->handle('maintenance.invoice.cancelled', subject: $facture, metadata: ['intervention_id' => $intervention->id]);

            return $facture;
        });
    }
}
