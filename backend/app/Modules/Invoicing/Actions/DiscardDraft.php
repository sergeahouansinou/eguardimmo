<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\Locks;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DiscardDraft
{
    public function __construct(
        private Locks $verrous,
        private RecordAudit $audit,
    ) {}

    /**
     * Abandonne un brouillon sans le supprimer, et sans trou de numérotation (il n'a jamais eu de numéro). Rejouable.
     */
    public function handle(string $invoiceId): Invoice
    {
        return DB::transaction(function () use ($invoiceId): Invoice {
            $facture = $this->verrous->invoice($invoiceId);

            if ($facture->status === InvoiceStatus::Discarded) {
                return $facture;
            }

            if ($facture->status !== InvoiceStatus::Draft || $facture->isCreditNote()) {
                throw ErrorCode::NotDraft->problem();
            }

            $facture->forceFill(['status' => InvoiceStatus::Discarded, 'discarded_at' => now(), 'lock_version' => $facture->lock_version + 1])->save();
            $this->audit->handle('invoicing.invoice.discarded', subject: $facture);

            return $facture;
        });
    }
}
