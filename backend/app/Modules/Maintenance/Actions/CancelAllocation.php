<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Support\Locks;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class CancelAllocation
{
    public function __construct(
        private Locks $verrous,
        private Ledger $livre,
        private RecordAudit $audit,
    ) {}

    /**
     * Contrepasse l'écriture d'imputation ; la facture redevient `recorded`. Les colonnes immuables (intervention, facture) se lisent
     * avant les verrous, l'ordre intervention, facture, imputation est ensuite tenu.
     */
    public function handle(string $allocationId): InvoiceAllocation
    {
        $repere = Str::isUuid($allocationId) ? InvoiceAllocation::query()->whereKey($allocationId)->first(['id', 'intervention_id', 'supplier_invoice_id']) : null;

        if ($repere === null) {
            throw ErrorCode::AllocationNotFound->problem();
        }

        return DB::transaction(function () use ($repere): InvoiceAllocation {
            $intervention = $this->verrous->intervention($repere->intervention_id);
            $facture = $this->verrous->invoice($repere->supplier_invoice_id, $intervention->id);
            $allocation = InvoiceAllocation::query()->whereKey($repere->id)->lockForUpdate()->first() ?? throw ErrorCode::AllocationNotFound->problem();

            if ($allocation->cancelled_at !== null) {
                return $allocation;
            }

            if ($intervention->status->isTerminal()) {
                throw ErrorCode::InvoiceStatusInvalid->problem();
            }

            $contrepassation = $this->livre->reverse($allocation->ledger_entry_id, CarbonImmutable::today());
            $allocation->forceFill(['cancelled_at' => now(), 'cancellation_entry_id' => $contrepassation->id])->save();

            if ($facture->status === SupplierInvoiceStatus::Allocated) {
                $facture->forceFill(['status' => SupplierInvoiceStatus::Recorded, 'lock_version' => $facture->lock_version + 1])->save();
            }

            $this->audit->handle('maintenance.allocation.cancelled', subject: $allocation, metadata: ['invoice_id' => $facture->id]);

            return $allocation;
        });
    }
}
