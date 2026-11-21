<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Data\NewPaymentData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Events\PaymentRecorded;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Support\Currencies;
use App\Modules\Rent\Support\OwnerRouting;
use App\Modules\Rent\Support\RecordedPayment;
use App\Modules\Rent\Support\Schedules;
use App\Modules\Rent\Support\Settlement;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class RecordPayment
{
    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private LeaseParticipants $participants,
        private Settlement $reglement,
        private OwnerRouting $routage,
        private Ledger $livre,
        private IssueSettledReceipts $quittances,
        private RecordAudit $audit,
    ) {}

    /**
     * Encaissement saisi : imputé sur les échéances appelées, la plus ancienne d'abord ; le surplus reste une avance du
     * bail. Encaissement et écriture comptable partagent une transaction (ADR 0007). La clé d'idempotence rejoue le
     * même contenu sans second encaissement et refuse un contenu différent. Les quittances des échéances soldées
     * s'émettent ensuite, hors de cette transaction ; `$issueReceipts` faux laisse l'appelant les émettre après sa propre transaction
     * (`IssueSettledReceipts`).
     */
    public function handle(NewPaymentData $donnees, CarbonImmutable $today, bool $issueReceipts = true): RecordedPayment
    {
        $bail = $this->baux->billing($donnees->leaseId);
        $this->echeanciers->assertBillable($bail);

        if ($donnees->amount <= 0 || $donnees->receivedOn > $today->toDateString()) {
            throw ErrorCode::PaymentInvalid->problem();
        }

        $empreinte = $this->fingerprint($donnees, $bail->currency);

        try {
            $resultat = DB::transaction(fn (): RecordedPayment => $this->record($bail, $donnees, $empreinte, $today));
        } catch (UniqueConstraintViolationException $erreur) {
            $resultat = new RecordedPayment($this->existing($donnees->idempotencyKey, $empreinte) ?? throw $erreur, true, []);
        }

        if ($issueReceipts && ! $resultat->replayed) {
            $resultat->receipts = $this->quittances->handle($resultat->settled, $today);
        }

        return $resultat;
    }

    private function record(LeaseBillingData $bail, NewPaymentData $donnees, string $empreinte, CarbonImmutable $today): RecordedPayment
    {
        $this->echeanciers->locked($bail, $today);

        $rejeu = $this->existing($donnees->idempotencyKey, $empreinte);

        if ($rejeu !== null) {
            return new RecordedPayment($rejeu, true, []);
        }

        $devise = Currencies::of($bail->currency);
        $montant = new Money($donnees->amount, $devise);
        $ouvertes = $this->reglement->lockedOpen($bail->leaseId);
        $restes = $this->reglement->outstanding($ouvertes);
        $partie = $donnees->partyId ?? $ouvertes[0]->party_id ?? $this->participants->tenantsAt($bail->leaseId, CarbonImmutable::parse(max($bail->startsOn, $today->toDateString())))[0]->partyId ?? null;

        $paiement = Payment::query()->create([
            'lease_id' => $bail->leaseId,
            'party_id' => $partie,
            'status' => PaymentStatus::Recorded,
            'method' => $donnees->method,
            'amount' => $montant,
            'received_on' => $donnees->receivedOn,
            'reference' => $donnees->reference,
            'note' => $donnees->note,
            'idempotency_key' => $donnees->idempotencyKey,
            'fingerprint' => $empreinte,
            'provider_reference' => $donnees->providerReference,
            'recorded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ]);

        $imputations = [];
        $reste = $montant;

        foreach ($ouvertes as $echeance) {
            $du = $restes[$echeance->id];

            if (! $reste->isPositive()) {
                break;
            }

            if ($du->isPositive()) {
                $part = $reste->lessThan($du) ? $reste : $du;
                $imputations[] = ['installment' => $echeance, 'amount' => $part, 'remaining' => $du->subtract($part)];
                $reste = $reste->subtract($part);
            }
        }

        $ecriture = $this->livre->post(new EntryData(
            Journal::Bank,
            CarbonImmutable::parse($donnees->receivedOn),
            sprintf('Encaissement %s du bail %s', $donnees->method->value, $bail->reference),
            SourceType::Payment,
            $paiement->id,
            'rent:payment:'.$paiement->id,
            $this->lines($bail, $paiement, $partie, $imputations, $reste),
            OnClosedPeriod::RollForward,
        ));

        $paiement->ledger_entry_id = $ecriture->id;
        $paiement->save();
        $soldees = [];

        foreach ($imputations as $imputation) {
            PaymentAllocation::query()->create([
                'payment_id' => $paiement->id,
                'installment_id' => $imputation['installment']->id,
                'amount' => $imputation['amount'],
                'currency' => $bail->currency,
                'ledger_entry_id' => $ecriture->id,
            ]);
            $this->reglement->sync($imputation['installment'], $imputation['remaining']);

            if ($imputation['installment']->status === InstallmentStatus::Paid) {
                $soldees[] = $imputation['installment'];
            }
        }

        $this->audit->handle('rent.payment.recorded', subject: $paiement, metadata: [
            'method' => $donnees->method->value,
            'allocations' => count($imputations),
            'advance' => $reste->isPositive(),
            'ledger_entry_id' => $ecriture->id,
        ]);
        PaymentRecorded::dispatch($paiement->id, $paiement->lease_id, $paiement->organization_id);

        return new RecordedPayment($paiement, false, $soldees);
    }

    /**
     * @param  list<array{installment: Installment, amount: Money, remaining: Money}>  $imputations
     * @return list<LineData>
     */
    private function lines(LeaseBillingData $bail, Payment $paiement, ?string $partie, array $imputations, Money $avance): array
    {
        $especes = $paiement->method === PaymentMethod::Cash;
        $creances = [];
        $mandants = [];
        $fiducie = new Money(0, $paiement->amount->getCurrency());

        foreach ($imputations as $imputation) {
            $echeance = $imputation['installment'];
            $creances[] = LineData::credit(AccountRole::TenantReceivable, $imputation['amount'], $bail->leaseId, $echeance->party_id ?? $partie, $echeance->unit_id, ItemType::Installment, $echeance->id);

            foreach ($this->reglement->collectLines($echeance, $imputation['amount']) as $ligne) {
                $mandants[] = $ligne;

                if ($ligne->account === AccountRole::OwnerPayable) {
                    $fiducie = $fiducie->add($ligne->amount);
                }
            }
        }

        $avanceRoutee = $avance->isPositive() && $this->routage->leaseIsRouted($bail->leaseId);

        if ($avanceRoutee) {
            $fiducie = $fiducie->add($avance);
        }

        $fiducie = $especes ? new Money(0, $fiducie->getCurrency()) : $fiducie;
        $autre = $paiement->amount->subtract($fiducie);
        $lignes = [];

        if ($fiducie->isPositive()) {
            $lignes[] = LineData::debit(AccountRole::TrustBank, $fiducie, $bail->leaseId, $partie);
        }

        if ($autre->isPositive()) {
            $lignes[] = LineData::debit($especes ? AccountRole::Cash : AccountRole::Bank, $autre, $bail->leaseId, $partie);
        }

        array_push($lignes, ...$creances, ...$mandants);

        if ($avance->isPositive()) {
            $lignes[] = LineData::credit(AccountRole::TenantReceivable, $avance, $bail->leaseId, $partie);
        }

        return $lignes;
    }

    private function existing(string $cle, string $empreinte): ?Payment
    {
        $paiement = Payment::query()->where('idempotency_key', $cle)->first();

        if ($paiement !== null && ! hash_equals($paiement->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $paiement;
    }

    private function fingerprint(NewPaymentData $donnees, string $devise): string
    {
        return hash('sha256', (string) json_encode([
            $donnees->leaseId, $donnees->amount, $devise, $donnees->method->value,
            $donnees->receivedOn, $donnees->reference, $donnees->note,
        ], JSON_THROW_ON_ERROR));
    }
}
