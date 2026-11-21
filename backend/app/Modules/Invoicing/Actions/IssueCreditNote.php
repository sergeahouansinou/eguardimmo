<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Jurisdictions\InvoiceRules;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Support\Calculator;
use App\Modules\Invoicing\Support\CreditedTotals;
use App\Modules\Invoicing\Support\CreditPlan;
use App\Modules\Invoicing\Support\DraftFingerprint;
use App\Modules\Invoicing\Support\Finalizer;
use App\Modules\Invoicing\Support\InvoiceWriter;
use App\Modules\Invoicing\Support\IssueChecks;
use App\Modules\Invoicing\Support\Locks;
use App\Modules\Invoicing\Support\ReferenceContext;
use App\Modules\Invoicing\Support\Statuses;
use App\Modules\Invoicing\Support\VatSchedule;
use App\Modules\Parties\Data\PartyInvoiceData;
use App\Modules\Parties\Enums\PartyKind;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class IssueCreditNote
{
    public function __construct(
        private Locks $verrous,
        private IssueChecks $controles,
        private InvoiceRules $juridictions,
        private CreditedTotals $deja,
        private CreditPlan $plan,
        private Calculator $calcul,
        private VatSchedule $tva,
        private Statuses $statuts,
        private InvoiceWriter $ecriture,
        private Finalizer $emission,
        private RecordAudit $audit,
    ) {}

    /**
     * Avoir sur une facture émise. La facture d'origine est verrouillée d'abord ; le cumul des avoirs ne dépasse ni la
     * quantité de chaque ligne ni le reste dû (aucun avoir ne crée de crédit client en phase 1). Même chaîne que
     * l'émission d'une facture. Rejouable par clé d'idempotence.
     *
     * @return array{invoice: Invoice, replayed: bool}
     */
    public function handle(string $invoiceId, CreditNoteData $demande, CarbonImmutable $today, bool $recreditOwner = false): array
    {
        $empreinte = DraftFingerprint::creditNote($invoiceId, $demande);

        try {
            return DB::transaction(function () use ($invoiceId, $demande, $today, $empreinte, $recreditOwner): array {
                $origine = $this->verrous->invoice($invoiceId);
                $rejeu = Invoice::query()->where('idempotency_key', $demande->idempotencyKey)->first();

                if ($rejeu !== null) {
                    return ['invoice' => $this->replay($rejeu, $empreinte), 'replayed' => true];
                }

                if ($origine->kind !== InvoiceKind::Invoice || ! in_array($origine->status, [InvoiceStatus::Issued, InvoiceStatus::PartiallyPaid, InvoiceStatus::Paid], true)) {
                    throw ErrorCode::NotCreditable->problem();
                }

                return ['invoice' => $this->issue($origine, $demande, $today, $empreinte, $recreditOwner), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = Invoice::query()->where('idempotency_key', $demande->idempotencyKey)->first() ?? throw $erreur;

            return ['invoice' => $this->replay($rejeu, $empreinte), 'replayed' => true];
        }
    }

    private function issue(Invoice $origine, CreditNoteData $demande, CarbonImmutable $today, string $empreinte, bool $recreditOwner): Invoice
    {
        $regles = $this->juridictions->for($origine->jurisdiction);
        $emetteur = $this->controles->issuer();
        $avoirs = $this->deja->of($origine->id);
        $chiffree = $this->calcul->price($this->plan->lines($origine, $demande, $avoirs), $regles, $origine->vat_regime, $today, $origine->currency, false);
        $reste = (int) $this->statuts->outstanding($origine)->getAmount();

        $recredit = $recreditOwner ? $this->compensated($origine, $chiffree->gross(), $reste) : 0;

        if ($chiffree->gross() <= 0 || $chiffree->gross() - $recredit > $reste) {
            throw ErrorCode::CreditExceedsOutstanding->problem();
        }

        $liberee = $this->tva->releaseOnCredit($origine, $chiffree->gross(), $chiffree->tax, $reste, $avoirs['gross'], $avoirs['tax']);
        $avoir = Invoice::query()->create([
            'kind' => InvoiceKind::CreditNote,
            'status' => InvoiceStatus::Draft,
            'credited_invoice_id' => $origine->id,
            'service_from' => $origine->service_from,
            'service_to' => $origine->service_to,
            'recipient_party_id' => $origine->recipient_party_id,
            'lease_id' => $origine->lease_id,
            'mandate_id' => $origine->mandate_id,
            'jurisdiction' => $origine->jurisdiction,
            'vat_regime' => $origine->vat_regime,
            'vat_on_debits' => $origine->vat_on_debits,
            'currency' => $origine->currency,
            'credit_reason' => $demande->reason,
            'idempotency_key' => $demande->idempotencyKey,
            'request_hash' => $empreinte,
            'lock_version' => 1,
            'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ]);
        $this->ecriture->write($avoir, $chiffree);
        $this->emission->finish($avoir, $chiffree, $emetteur, $this->recipient($origine), $this->references($origine), $regles, $today, $origine, $liberee, $recredit);
        $this->statuts->sync($origine);
        $this->audit->handle('invoicing.invoice.credited', subject: $avoir, metadata: [
            'number' => $avoir->number,
            'credited_invoice_id' => $origine->id,
            'total_gross' => $chiffree->gross(),
        ]);

        return $avoir;
    }

    /**
     * Part de l'avoir qui dépasse le reste dû et que la compensation sur le compte du mandant a déjà réglée : elle lui est recréditée.
     */
    private function compensated(Invoice $origine, int $avoirTtc, int $reste): int
    {
        $excedent = max(0, $avoirTtc - $reste);

        if ($excedent === 0) {
            return 0;
        }

        $compense = (int) InvoicePayment::query()
            ->where('invoice_id', $origine->id)->where('method', PaymentMethod::OwnerAccount->value)->whereNull('cancelled_at')
            ->sum('amount');

        return min($excedent, $compense);
    }

    private function replay(Invoice $existante, string $empreinte): Invoice
    {
        if ($existante->kind !== InvoiceKind::CreditNote || ! hash_equals((string) $existante->request_hash, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante;
    }

    /**
     * Le destinataire d'un avoir est celui de la facture d'origine, lu dans son instantané : aucune fiche n'est relue.
     */
    private function recipient(Invoice $origine): PartyInvoiceData
    {
        /** @var array<string, mixed> $r */
        $r = is_array($origine->snapshot['recipient'] ?? null) ? $origine->snapshot['recipient'] : [];
        /** @var array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null $adresse */
        $adresse = is_array($r['address'] ?? null) ? $r['address'] : null;

        return new PartyInvoiceData(
            $origine->recipient_party_id,
            (string) ($r['name'] ?? ''),
            PartyKind::tryFrom((string) ($r['kind'] ?? '')) ?? PartyKind::Person,
            $adresse,
            isset($r['siren']) ? (string) $r['siren'] : null,
            isset($r['siret']) ? (string) $r['siret'] : null,
            isset($r['vat_number']) ? (string) $r['vat_number'] : null,
            null,
            false,
        );
    }

    private function references(Invoice $origine): ReferenceContext
    {
        $refs = is_array($origine->snapshot['references'] ?? null) ? $origine->snapshot['references'] : [];

        return new ReferenceContext(false, false, false, $refs['lease']['reference'] ?? null, $refs['mandate']['reference'] ?? null);
    }
}
