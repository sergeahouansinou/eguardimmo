<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Jurisdictions\InvoiceRules;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Support\Calculator;
use App\Modules\Invoicing\Support\DraftLines;
use App\Modules\Invoicing\Support\Finalizer;
use App\Modules\Invoicing\Support\InvoiceWriter;
use App\Modules\Invoicing\Support\IssueChecks;
use App\Modules\Invoicing\Support\Locks;
use App\Modules\Invoicing\Support\PricingLine;
use App\Modules\Invoicing\Support\References;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class IssueInvoice
{
    public function __construct(
        private Locks $verrous,
        private IssueChecks $controles,
        private InvoiceRules $juridictions,
        private References $references,
        private Calculator $calcul,
        private DraftLines $brouillon,
        private InvoiceWriter $ecriture,
        private Finalizer $emission,
        private RecordAudit $audit,
    ) {}

    /**
     * Émet un brouillon dans une seule transaction, sous le verrou de sa ligne : contrôles, recalcul serveur des taux et
     * des totaux, numéro, instantané, PDF, écriture au grand livre, puis statut `issued` (ADR 0028). `issued_on` est la
     * date du serveur : la numérotation reste chronologique. Rejouable : une pièce déjà émise est renvoyée telle quelle.
     *
     * @return array{invoice: Invoice, replayed: bool}
     */
    public function handle(string $invoiceId, CarbonImmutable $today): array
    {
        return DB::transaction(function () use ($invoiceId, $today): array {
            $facture = $this->verrous->invoice($invoiceId);

            if ($facture->status->isEmitted() && ! $facture->isCreditNote()) {
                return ['invoice' => $facture, 'replayed' => true];
            }

            if ($facture->status !== InvoiceStatus::Draft || $facture->isCreditNote()) {
                throw ErrorCode::NotDraft->problem();
            }

            $regles = $this->juridictions->for($facture->jurisdiction);
            $emetteur = $this->controles->issuer();
            $destinataire = $this->controles->recipient($facture->recipient_party_id);

            if ($regles->requiresEInvoicing($destinataire, $today)) {
                throw ErrorCode::EInvoicingRequired->problem();
            }

            $refs = $this->references->check($facture->recipient_party_id, $facture->lease_id, $facture->mandate_id);
            $echeance = $facture->due_on?->toDateString() ?? $today->addDays($emetteur->paymentTermsDays ?? (int) config('invoicing.payment_terms_days'))->toDateString();

            if ($echeance < $today->toDateString()) {
                throw ErrorCode::DueDateInvalid->problem();
            }

            $lignes = array_map(fn (InvoiceLine $l): PricingLine => new PricingLine(
                $l->item_term_id, InvoiceItemSemantic::from($l->item_semantic), $l->description, $l->quantity_milli, $l->unit_price,
                $l->tax_category, $l->tax_rate_key,
            ), array_values($facture->lines()->get()->all()));

            foreach ($lignes as $ligne) {
                $this->brouillon->assertManuallyEntered($ligne->semantic, $facture->fee_statement_id !== null);
                $regles->assertItemAllowed($ligne->semantic, $refs->recipientIsMandant);
            }

            $chiffree = $this->calcul->price($lignes, $regles, $emetteur->vatRegime, $today, $regles->currency(), $refs->recipientIsVatRegisteredCompany);

            if ($chiffree->gross() <= 0) {
                throw ErrorCode::LinesInvalid->problem();
            }

            $facture->due_on = Carbon::parse($echeance);
            $this->ecriture->write($facture, $chiffree);
            $this->emission->finish($facture, $chiffree, $emetteur, $destinataire, $refs, $regles, $today);
            $this->audit->handle('invoicing.invoice.issued', subject: $facture, metadata: ['number' => $facture->number, 'total_gross' => (int) $facture->total_gross->getAmount()]);

            return ['invoice' => $facture, 'replayed' => false];
        });
    }
}
