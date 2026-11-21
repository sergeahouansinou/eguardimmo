<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Models\SupplierPayment;
use App\Modules\Maintenance\Support\Locks;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class CancelSupplierPayment
{
    public function __construct(
        private Locks $verrous,
        private Ledger $livre,
        private RecordAudit $audit,
    ) {}

    public function handle(string $paymentId): SupplierPayment
    {
        $repere = Str::isUuid($paymentId) ? SupplierPayment::query()->whereKey($paymentId)->first(['id', 'supplier_invoice_id']) : null;
        $interventionId = $repere === null ? null : SupplierInvoice::query()->whereKey($repere->supplier_invoice_id)->value('intervention_id');

        if ($repere === null || ! is_string($interventionId)) {
            throw ErrorCode::PaymentNotFound->problem();
        }

        return DB::transaction(function () use ($repere, $interventionId): SupplierPayment {
            $this->verrous->intervention($interventionId);
            $facture = $this->verrous->invoice($repere->supplier_invoice_id, $interventionId);
            $paiement = SupplierPayment::query()->whereKey($repere->id)->lockForUpdate()->first() ?? throw ErrorCode::PaymentNotFound->problem();

            if ($paiement->cancelled_at !== null) {
                return $paiement;
            }

            $contrepassation = $this->livre->reverse($paiement->ledger_entry_id, CarbonImmutable::today());
            $paiement->forceFill(['cancelled_at' => now(), 'cancellation_entry_id' => $contrepassation->id])->save();
            $this->audit->handle('maintenance.payment.cancelled', subject: $paiement, metadata: ['invoice_id' => $facture->id]);

            return $paiement;
        });
    }
}
