<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Data\AdjustmentCreditData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Support\Schedules;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class CreditAdjustment
{
    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private LeaseParticipants $participants,
        private Ledger $livre,
    ) {}

    /**
     * Régularisation en faveur du locataire : crédit du compte locataire sans créance, porté par un encaissement de méthode
     * `charge_credit` que l'avis suivant reprend comme toute avance. Autonome : débit des charges récupérées ; lot sous mandat :
     * débit du compte du mandant, jamais un produit d'agence. Verrou du bail, puis du compte du mandant. Rejouable par décompte.
     */
    public function handle(string $leaseId, string $statementId, Money $montant, ?string $unitId, ?string $mandantPartyId, CarbonImmutable $date): AdjustmentCreditData
    {
        $bail = $this->baux->billing($leaseId);
        $this->echeanciers->assertBillable($bail);

        if (! $montant->isPositive()) {
            throw ErrorCode::AdjustmentConflict->problem('Un crédit de régularisation est strictement positif.');
        }

        $cle = "charges:statement:{$statementId}:credit";
        $empreinte = hash('sha256', (string) json_encode([$leaseId, $statementId, $montant->getAmount(), $montant->getCurrency()->getCode(), $unitId, $mandantPartyId], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($bail, $statementId, $montant, $unitId, $mandantPartyId, $date, $cle, $empreinte): AdjustmentCreditData {
            $this->echeanciers->locked($bail, $date);

            if ($mandantPartyId !== null) {
                $this->livre->lockParty($mandantPartyId);
            }

            $existant = Payment::query()->where('idempotency_key', $cle)->first();

            if ($existant !== null) {
                if (! hash_equals($existant->fingerprint, $empreinte)) {
                    throw ErrorCode::IdempotencyKeyReused->problem();
                }

                return new AdjustmentCreditData($existant->id, (string) $existant->ledger_entry_id, true);
            }

            $locataire = $this->participants->tenantsAt($bail->leaseId, $date)[0]->partyId ?? null;
            $paiement = Payment::query()->create([
                'lease_id' => $bail->leaseId,
                'party_id' => $locataire,
                'status' => PaymentStatus::Recorded,
                'method' => PaymentMethod::ChargeCredit,
                'amount' => $montant,
                'received_on' => $date->toDateString(),
                'idempotency_key' => $cle,
                'fingerprint' => $empreinte,
                'recorded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            $debit = $mandantPartyId === null
                ? LineData::debit(AccountRole::ChargesRecovered, $montant, $bail->leaseId, $locataire, $unitId)
                : LineData::debit(AccountRole::OwnerPayable, $montant, $bail->leaseId, $mandantPartyId, $unitId);

            $ecriture = $this->livre->post(new EntryData(
                Journal::Adjustments,
                $date,
                sprintf('Régularisation de charges en faveur du locataire, bail %s', $bail->reference),
                SourceType::ChargeStatement,
                $statementId,
                $cle,
                [$debit, LineData::credit(AccountRole::TenantReceivable, $montant, $bail->leaseId, $locataire, $unitId)],
                OnClosedPeriod::RollForward,
            ));

            $paiement->ledger_entry_id = $ecriture->id;
            $paiement->save();

            return new AdjustmentCreditData($paiement->id, $ecriture->id, false);
        });
    }
}
