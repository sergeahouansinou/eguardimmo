<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Support\Locks;
use App\Modules\Invoicing\Support\Statuses;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class CancelInvoicePayment
{
    public function __construct(
        private Locks $verrous,
        private Statuses $statuts,
        private Ledger $livre,
        private RecordAudit $audit,
    ) {}

    /**
     * Annule un règlement sans rien supprimer : son écriture est contrepassée (la TVA transférée à l'encaissement revient
     * en TVA différée) et le statut de la facture se relit au grand livre. Rejouable : un règlement déjà annulé est renvoyé tel quel.
     */
    public function handle(string $invoiceId, string $paymentId, CarbonImmutable $today): InvoicePayment
    {
        return DB::transaction(function () use ($invoiceId, $paymentId, $today): InvoicePayment {
            $facture = $this->verrous->invoice($invoiceId);
            $paiement = (Str::isUuid($paymentId)
                ? InvoicePayment::query()->whereKey($paymentId)->where('invoice_id', $facture->id)->lockForUpdate()->first()
                : null) ?? throw ErrorCode::PaymentNotFound->problem();

            if ($paiement->cancelled_at !== null) {
                return $paiement;
            }

            if ($paiement->method === PaymentMethod::OwnerAccount) {
                throw ErrorCode::PaymentInvalid->problem('Une compensation sur le compte du mandant ne s\'annule pas : émettez un avoir.');
            }

            $contrepassation = $this->livre->reverse($paiement->ledger_entry_id, $today);
            $paiement->cancelled_at = now();
            $paiement->cancellation_entry_id = $contrepassation->id;
            $paiement->save();

            $this->statuts->sync($facture);
            $this->audit->handle('invoicing.payment.cancelled', subject: $paiement, metadata: ['invoice_id' => $facture->id, 'amount' => (int) $paiement->amount->getAmount()]);

            return $paiement;
        });
    }
}
