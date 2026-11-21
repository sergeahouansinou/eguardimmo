<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Maintenance\Data\SupplierPaymentInputData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Enums\SupplierPaymentMethod;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Models\SupplierPayment;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Currencies;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Postings;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

final readonly class RecordSupplierPayment
{
    public function __construct(
        private Locks $verrous,
        private Committed $engage,
        private Postings $ecritures,
        private Ledger $livre,
        private LedgerReader $soldes,
        private LedgerAggregates $agregats,
        private MembershipDirectory $equipe,
        private RecordAudit $audit,
    ) {}

    /**
     * Règlement manuel d'une facture reçue, jamais au-delà du reste dû lu au grand livre. Rejouable par clé d'idempotence.
     *
     * @return array{payment: SupplierPayment, replayed: bool}
     */
    public function handle(string $interventionId, string $invoiceId, SupplierPaymentInputData $donnees): array
    {
        $empreinte = hash('sha256', (string) json_encode([$invoiceId, $donnees->amount, $donnees->method->value, $donnees->paidOn, $donnees->reference, $donnees->ownFundsAdvance], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($interventionId, $invoiceId, $donnees, $empreinte): array {
                $intervention = $this->verrous->intervention($interventionId);
                $facture = $this->verrous->invoice($invoiceId, $interventionId);
                $rejeu = SupplierPayment::query()->where('idempotency_key', $donnees->idempotencyKey)->first();

                if ($rejeu !== null) {
                    return ['payment' => $this->replay($rejeu, $empreinte), 'replayed' => true];
                }

                return ['payment' => $this->record($intervention, $facture, $donnees, $empreinte), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = SupplierPayment::query()->where('idempotency_key', $donnees->idempotencyKey)->first() ?? throw $erreur;

            return ['payment' => $this->replay($rejeu, $empreinte), 'replayed' => true];
        }
    }

    private function record(Intervention $intervention, SupplierInvoice $facture, SupplierPaymentInputData $donnees, string $empreinte): SupplierPayment
    {
        if ($facture->status === SupplierInvoiceStatus::Cancelled) {
            throw ErrorCode::InvoiceStatusInvalid->problem();
        }

        $engage = $this->engage->amount($intervention);

        if ($engage !== null && $this->engage->invoicedGross($intervention->id, $facture->id) > $engage) {
            throw ErrorCode::InvoiceExceedsApproval->problem('Cette facture dépasse le montant engagé : un avenant accepté est nécessaire avant tout règlement.');
        }

        if ($donnees->amount <= 0 || $donnees->paidOn > CarbonImmutable::today()->toDateString() || $donnees->paidOn < $facture->invoice_on->toDateString()) {
            throw ErrorCode::PaymentInvalid->problem();
        }

        $monnaie = Currencies::of($facture->currency);
        $reste = (int) $this->soldes->supplierOutstanding($facture->id, $monnaie)->getAmount();

        if ($donnees->amount > $reste) {
            throw ErrorCode::PaymentExceedsOutstanding->problem();
        }

        $id = (string) Str::uuid7();
        $montant = new Money($donnees->amount, $monnaie);
        $sortie = $this->source($intervention, $facture, $donnees, $monnaie, $engage);
        $ecriture = $this->livre->post($this->ecritures->payment($facture, $id, $montant, $sortie, $donnees->paidOn));

        $paiement = new SupplierPayment;
        $paiement->forceFill([
            'id' => $id,
            'supplier_invoice_id' => $facture->id,
            'amount' => $montant,
            'currency' => $facture->currency,
            'paid_on' => $donnees->paidOn,
            'method' => $donnees->method,
            'reference' => $donnees->reference,
            'idempotency_key' => $donnees->idempotencyKey,
            'fingerprint' => $empreinte,
            'ledger_entry_id' => $ecriture->id,
            'recorded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ])->save();

        $this->audit->handle('maintenance.payment.recorded', subject: $paiement, metadata: ['invoice_id' => $facture->id, 'amount' => $montant, 'method' => $donnees->method->value, 'source' => $sortie->value]);

        return $paiement;
    }

    /**
     * Compte débité de la trésorerie. Sur un lot sous mandat avec fonds des mandants actifs, un règlement ne sort de la
     * banque de cantonnement que si le compte du mandant, une fois la facture imputée, reste créditeur ; l'avance sur
     * fonds propres est une saisie explicite, tracée à l'audit, qui laisse une créance sur le mandant.
     */
    private function source(Intervention $intervention, SupplierInvoice $facture, SupplierPaymentInputData $donnees, Currency $monnaie, ?int $engage): AccountRole
    {
        $propre = $donnees->method === SupplierPaymentMethod::Cash ? AccountRole::Cash : AccountRole::Bank;

        if ($intervention->mandant_party_id === null || $this->soldes->ownerFundsCutoverAt() === null || $donnees->ownFundsAdvance) {
            return $propre;
        }

        if ($donnees->method === SupplierPaymentMethod::Cash) {
            throw ErrorCode::PaymentInvalid->problem('Un règlement en espèces ne sort pas de la banque de tiers : saisissez une avance sur fonds propres.');
        }

        if ($engage === null) {
            throw ErrorCode::PaymentEngagementRequired->problem('Aucun engagement ne couvre cette intervention : engagez les travaux ou acceptez un devis avant de régler sur les fonds du mandant.');
        }

        $this->assertSecondApprover($facture, $donnees->amount);
        $this->livre->lockParty($intervention->mandant_party_id);

        if (! $this->agregats->trustCoverage($monnaie)->covered) {
            throw ErrorCode::TrustFundsGap->problem('Le compte de tiers ne couvre pas ce que l\'agence doit aux mandants et aux locataires : réglez en avance sur fonds propres ou résorbez l\'écart.');
        }

        $solde = $this->agregats->ownerFunds([$intervention->mandant_party_id], $monnaie)[$intervention->mandant_party_id]->payable ?? new Money(0, $monnaie);
        $disponible = $solde->subtract($this->soldes->worksPending($facture->id, $monnaie));

        if ($disponible->isNegative()) {
            throw ErrorCode::OwnerFundsInsufficient->problem('Le solde du mandant ne couvre pas cette facture : réglez-la en avance sur fonds propres ou attendez un encaissement.');
        }

        return AccountRole::TrustBank;
    }

    /**
     * Double contrôle au-delà du seuil : la personne qui règle sur fonds de tiers n'est pas celle qui a saisi la facture,
     * sauf quand l'équipe ne compte qu'un membre habilité.
     */
    private function assertSecondApprover(SupplierInvoice $facture, int $montant): void
    {
        if ($montant <= (int) config('maintenance.third_party_second_approval_minor') || $facture->created_by_user_id !== auth()->id()) {
            return;
        }

        $habilites = array_filter($this->equipe->activeTeam(), fn (TeamMemberData $m): bool => in_array($m->role, [MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant], true));

        if (count($habilites) >= 2) {
            throw ErrorCode::PaymentSecondApproverRequired->problem('Au-delà du seuil, le règlement sur fonds de tiers doit être validé par une autre personne que celle qui a saisi la facture.');
        }
    }

    private function replay(SupplierPayment $existant, string $empreinte): SupplierPayment
    {
        if (! hash_equals($existant->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existant;
    }
}
