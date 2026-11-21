<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Invoicing\Data\NewPaymentData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Support\CreditedTotals;
use App\Modules\Invoicing\Support\Currencies;
use App\Modules\Invoicing\Support\DraftFingerprint;
use App\Modules\Invoicing\Support\Locks;
use App\Modules\Invoicing\Support\Postings;
use App\Modules\Invoicing\Support\Statuses;
use App\Modules\Invoicing\Support\VatSchedule;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

final readonly class RecordInvoicePayment
{
    public function __construct(
        private Locks $verrous,
        private Statuses $statuts,
        private CreditedTotals $avoirs,
        private VatSchedule $tva,
        private Postings $ecritures,
        private Ledger $livre,
        private RecordAudit $audit,
    ) {}

    /**
     * Règlement manuel d'une facture émise, jamais au-delà du reste dû lu au grand livre. La TVA exigible à l'encaissement
     * passe de `VatDeferred` à `VatCollected` dans la même écriture. Rejouable par clé d'idempotence. `$rollForward` : un règlement antidaté dans un mois clos est reporté sur le premier jour ouvert au lieu d'être refusé (rapprochement bancaire).
     *
     * @return array{payment: InvoicePayment, replayed: bool}
     */
    public function handle(string $invoiceId, NewPaymentData $donnees, CarbonImmutable $today, bool $rollForward = false): array
    {
        if ($donnees->amount <= 0 || $donnees->paidOn > $today->toDateString()) {
            throw ErrorCode::PaymentInvalid->problem();
        }

        $empreinte = DraftFingerprint::payment($invoiceId, $donnees);

        try {
            return DB::transaction(function () use ($invoiceId, $donnees, $empreinte, $rollForward): array {
                $facture = $this->verrous->invoice($invoiceId);
                $rejeu = InvoicePayment::query()->where('idempotency_key', $donnees->idempotencyKey)->first();

                if ($rejeu !== null) {
                    return ['payment' => $this->replay($rejeu, $empreinte), 'replayed' => true];
                }

                return ['payment' => $this->record($facture, $donnees, $empreinte, $rollForward), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = InvoicePayment::query()->where('idempotency_key', $donnees->idempotencyKey)->first() ?? throw $erreur;

            return ['payment' => $this->replay($rejeu, $empreinte), 'replayed' => true];
        }
    }

    private function record(Invoice $facture, NewPaymentData $donnees, string $empreinte, bool $rollForward): InvoicePayment
    {
        if ($facture->kind !== InvoiceKind::Invoice || ! in_array($facture->status, [InvoiceStatus::Issued, InvoiceStatus::PartiallyPaid, InvoiceStatus::Paid], true)) {
            throw ErrorCode::NotPayable->problem();
        }

        if ($facture->issued_on === null || $donnees->paidOn < $facture->issued_on->toDateString()) {
            throw ErrorCode::PaymentInvalid->problem();
        }

        $reste = (int) $this->statuts->outstanding($facture)->getAmount();

        if ($donnees->amount > $reste) {
            throw ErrorCode::PaymentExceedsOutstanding->problem();
        }

        $deja = $this->avoirs->of($facture->id);
        $exigible = $this->tva->transferOnPayment($facture, $donnees->amount, $reste, $deja['gross'], $deja['tax']);
        $id = (string) Str::uuid7();
        $ecriture = $this->livre->post($this->ecritures->payment($facture, $id, $donnees->amount, $donnees->method, $donnees->paidOn, $exigible, $rollForward ? OnClosedPeriod::RollForward : OnClosedPeriod::Refuse));

        $paiement = new InvoicePayment;
        $paiement->forceFill([
            'id' => $id,
            'invoice_id' => $facture->id,
            'amount' => new Money($donnees->amount, Currencies::of($facture->currency)),
            'currency' => $facture->currency,
            'paid_on' => $donnees->paidOn,
            'method' => $donnees->method,
            'reference' => $donnees->reference,
            'idempotency_key' => $donnees->idempotencyKey,
            'fingerprint' => $empreinte,
            'ledger_entry_id' => $ecriture->id,
            'recorded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ])->save();

        $this->statuts->sync($facture);
        $this->audit->handle('invoicing.payment.recorded', subject: $paiement, metadata: [
            'invoice_id' => $facture->id,
            'amount' => new Money($donnees->amount, Currencies::of($facture->currency)),
            'method' => $donnees->method->value,
            'vat_collected' => $exigible,
        ]);

        return $paiement;
    }

    private function replay(InvoicePayment $existant, string $empreinte): InvoicePayment
    {
        if (! hash_equals($existant->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existant;
    }
}
