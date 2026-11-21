<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Mail\InvoiceMail;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\Locks;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

final readonly class SendInvoice
{
    public function __construct(
        private Locks $verrous,
        private PartyDirectory $parties,
        private RecordAudit $audit,
    ) {}

    /**
     * Met en file le PDF émis, tel que figé à l'émission, pour l'adresse courante du destinataire. `sent_at` et le journal
     * sont écrits dans la transaction ; l'e-mail n'est mis en file qu'après son commit. Le renvoi est permis. Sans adresse,
     * rien n'est envoyé.
     */
    public function handle(string $invoiceId): Invoice
    {
        return DB::transaction(function () use ($invoiceId): Invoice {
            $facture = $this->verrous->invoice($invoiceId);

            if (! $facture->status->isEmitted() || $facture->stored_file_id === null) {
                throw ErrorCode::NotIssued->problem();
            }

            $destinataire = $this->parties->invoiceIdentity($facture->recipient_party_id);

            if ($destinataire->primaryEmail === null || $destinataire->primaryEmail === '') {
                throw ErrorCode::RecipientEmailMissing->problem();
            }

            $emetteur = is_array($facture->snapshot['issuer'] ?? null) ? (string) ($facture->snapshot['issuer']['name'] ?? '') : '';

            $courriel = new InvoiceMail(
                $emetteur,
                (string) $facture->number,
                $facture->isCreditNote(),
                $facture->due_on?->format('d/m/Y'),
                (string) $facture->organization_id,
                $facture->stored_file_id,
            );
            $adresse = $destinataire->primaryEmail;

            $facture->sent_at = now();
            $facture->save();
            $this->audit->handle('invoicing.invoice.sent', subject: $facture, metadata: ['number' => $facture->number]);
            DB::afterCommit(fn () => Mail::to($adresse)->queue($courriel));

            return $facture;
        });
    }
}
