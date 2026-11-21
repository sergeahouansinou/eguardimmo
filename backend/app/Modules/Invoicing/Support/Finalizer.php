<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Data\LegalIdentityData;
use App\Modules\Parties\Data\PartyInvoiceData;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * Chaîne commune à l'émission d'une facture et d'un avoir, dans la transaction de l'appelant et sous le verrou de la
 * ligne `invoices` : numéro, instantané, PDF (Gotenberg), pièce Documents, écriture au grand livre, puis statut.
 * Le PDF précède l'écriture : une panne laisse le grand livre intact et libère le numéro.
 */
final readonly class Finalizer
{
    public function __construct(
        private Numbers $numeros,
        private Snapshots $instantanes,
        private InvoiceHtml $html,
        private PdfRenderer $pdf,
        private IssuedDocuments $documents,
        private Postings $ecritures,
        private Ledger $livre,
    ) {}

    public function finish(
        Invoice $facture,
        PricedInvoice $chiffree,
        LegalIdentityData $emetteur,
        PartyInvoiceData $destinataire,
        ReferenceContext $references,
        InvoiceTaxRules $regles,
        CarbonImmutable $today,
        ?Invoice $origine = null,
        int $tvaLiberee = 0,
        int $recreditProprietaire = 0,
    ): Invoice {
        $numero = $this->numeros->next($facture->kind, $today);
        $facture->number = $numero;
        $facture->issued_on = Carbon::instance($today);

        $role = $origine !== null ? Postings::receivableOf($origine) : Postings::receivable($facture, $references->recipientOnLease);
        $differee = $origine !== null ? ($origine->snapshot['ledger']['vat_deferred'] ?? false) === true : $regles->isVatDeferred($emetteur->vatOnDebits);
        $instantane = $this->instantanes->build($facture, $numero, $chiffree, $emetteur, $destinataire, $references, $regles, $role->value, $differee, $today, $origine);

        $pdf = $this->pdf->render($this->html->render($instantane));
        $credit = $facture->kind === InvoiceKind::CreditNote;
        $piece = $this->documents->issue(new NewIssuedDocumentData(
            $credit ? IssuedDocumentType::CreditNote : IssuedDocumentType::Invoice,
            $instantane,
            $regles->templateVersion(),
            FileSource::contents($pdf),
            ($credit ? 'avoir-' : 'facture-').$numero.'.pdf',
            new DocumentSubject('invoice', $facture->id),
        ));

        $ecriture = $this->livre->post($origine !== null
            ? $this->ecritures->creditNote($facture, $origine, $chiffree, $tvaLiberee, $recreditProprietaire)
            : $this->ecritures->issue($facture, $chiffree, $references->recipientOnLease, $differee));

        $facture->forceFill([
            'status' => InvoiceStatus::Issued,
            'vat_regime' => $emetteur->vatRegime,
            'vat_on_debits' => $emetteur->vatOnDebits,
            'ledger_entry_id' => $ecriture->id,
            'issued_document_id' => $piece->id,
            'stored_file_id' => $piece->file->id,
            'fingerprint' => $piece->fingerprint,
            'template_version' => $piece->templateVersion,
            'snapshot' => $instantane,
            'issued_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            'lock_version' => $facture->lock_version + 1,
        ])->save();

        return $facture;
    }
}
