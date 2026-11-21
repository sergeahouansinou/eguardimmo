<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\DraftPricer;
use App\Modules\Invoicing\Support\InvoiceWriter;
use App\Modules\Invoicing\Support\Locks;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class UpdateDraft
{
    public function __construct(
        private Locks $verrous,
        private DraftPricer $chiffrage,
        private InvoiceWriter $ecriture,
        private RecordAudit $audit,
    ) {}

    /**
     * Remplace le contenu d'un brouillon ; `lock_version` protège d'une modification concurrente (409).
     */
    public function handle(string $invoiceId, DraftData $donnees, CarbonImmutable $today): Invoice
    {
        return DB::transaction(function () use ($invoiceId, $donnees, $today): Invoice {
            $facture = $this->verrous->invoice($invoiceId);

            if ($facture->status !== InvoiceStatus::Draft || $facture->isCreditNote()) {
                throw ErrorCode::NotDraft->problem();
            }

            if ($donnees->lockVersion !== $facture->lock_version) {
                throw ErrorCode::StaleVersion->problem();
            }

            $prepare = $this->chiffrage->price($donnees, $today);
            $facture->forceFill([
                'due_on' => $donnees->dueOn,
                'service_from' => $donnees->serviceFrom,
                'service_to' => $donnees->serviceTo,
                'recipient_party_id' => $donnees->recipientPartyId,
                'lease_id' => $donnees->leaseId,
                'mandate_id' => $donnees->mandateId,
                'jurisdiction' => $prepare->jurisdiction,
                'vat_regime' => $prepare->regime,
                'vat_on_debits' => $prepare->vatOnDebits,
                'currency' => $prepare->priced->currency,
                'lock_version' => $facture->lock_version + 1,
            ]);
            $this->ecriture->write($facture, $prepare->priced);
            $this->audit->handle('invoicing.invoice.updated', subject: $facture, metadata: ['lines' => count($donnees->lines)]);

            return $facture;
        });
    }
}
