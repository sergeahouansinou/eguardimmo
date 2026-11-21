<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\DraftFingerprint;
use App\Modules\Invoicing\Support\DraftPricer;
use App\Modules\Invoicing\Support\InvoiceWriter;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateDraft
{
    public function __construct(
        private DraftPricer $chiffrage,
        private InvoiceWriter $ecriture,
        private RecordAudit $audit,
    ) {}

    /**
     * Brouillon : sans numéro, sans écriture comptable. Le serveur chiffre tout. Une clé d'idempotence rejoue le même
     * contenu (`replayed`) et refuse un contenu différent.
     *
     * @return array{invoice: Invoice, replayed: bool}
     */
    public function handle(DraftData $donnees, CarbonImmutable $today): array
    {
        $empreinte = DraftFingerprint::draft($donnees);

        try {
            return DB::transaction(function () use ($donnees, $today, $empreinte): array {
                $rejeu = $this->existing($donnees->idempotencyKey, $empreinte);

                if ($rejeu !== null) {
                    return ['invoice' => $rejeu, 'replayed' => true];
                }

                $prepare = $this->chiffrage->price($donnees, $today);
                $facture = Invoice::query()->create([
                    'kind' => InvoiceKind::Invoice,
                    'status' => InvoiceStatus::Draft,
                    'due_on' => $donnees->dueOn,
                    'service_from' => $donnees->serviceFrom,
                    'service_to' => $donnees->serviceTo,
                    'recipient_party_id' => $donnees->recipientPartyId,
                    'lease_id' => $donnees->leaseId,
                    'mandate_id' => $donnees->mandateId,
                    'fee_statement_id' => $donnees->feeStatementId,
                    'jurisdiction' => $prepare->jurisdiction,
                    'vat_regime' => $prepare->regime,
                    'vat_on_debits' => $prepare->vatOnDebits,
                    'currency' => $prepare->priced->currency,
                    'idempotency_key' => $donnees->idempotencyKey,
                    'request_hash' => $empreinte,
                    'lock_version' => 1,
                    'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                ]);
                $this->ecriture->write($facture, $prepare->priced);
                $this->audit->handle('invoicing.invoice.drafted', subject: $facture, metadata: ['lines' => count($donnees->lines)]);

                return ['invoice' => $facture, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $existante = $this->existing($donnees->idempotencyKey, $empreinte) ?? throw $erreur;

            return ['invoice' => $existante, 'replayed' => true];
        }
    }

    private function existing(?string $cle, string $empreinte): ?Invoice
    {
        if ($cle === null) {
            return null;
        }

        $facture = Invoice::query()->where('idempotency_key', $cle)->first();

        if ($facture !== null && ! hash_equals((string) $facture->request_hash, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $facture;
    }
}
