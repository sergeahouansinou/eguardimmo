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
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\AdvanceRefund;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\Advances;
use App\Modules\Rent\Support\Currencies;
use App\Modules\Rent\Support\RefundedAdvance;
use App\Modules\Rent\Support\Schedules;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

final readonly class RefundAdvance
{
    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private Advances $avances,
        private Ledger $livre,
        private LedgerReader $lecteur,
        private RecordAudit $audit,
    ) {}

    /**
     * Rend au locataire tout ou partie de l'avance de son bail, la plus ancienne d'abord, jamais au-delà de ce qui reste : débit du
     * compte locataire, crédit de la banque de tiers quand le bail est routé vers un mandant, de la banque sinon. Rejouable par clé.
     */
    public function handle(string $leaseId, int $montant, CarbonImmutable $date, ?string $reference, string $cle, CarbonImmutable $today): RefundedAdvance
    {
        $bail = $this->baux->billing($leaseId);
        $this->echeanciers->assertBillable($bail);

        if ($montant <= 0 || $date->greaterThan($today)) {
            throw ErrorCode::RefundInvalid->problem();
        }

        $empreinte = hash('sha256', (string) json_encode([$leaseId, $montant, $bail->currency, $date->toDateString(), $reference], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(fn (): RefundedAdvance => $this->refund($bail->leaseId, $bail->currency, $bail->reference, $montant, $date, $reference, $cle, $empreinte, $today));
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->existing($cle, $empreinte) ?? throw $erreur;
        }
    }

    private function refund(string $leaseId, string $devise, string $referenceBail, int $montant, CarbonImmutable $date, ?string $reference, string $cle, string $empreinte, CarbonImmutable $today): RefundedAdvance
    {
        $this->echeanciers->lockExisting($leaseId);
        $rejeu = $this->existing($cle, $empreinte);

        if ($rejeu !== null) {
            return $rejeu;
        }

        $routee = Installment::query()->where('lease_id', $leaseId)->whereNotNull('mandant_party_id')->orderByDesc('period_start')->first();

        if ($routee !== null) {
            $this->livre->lockParty((string) $routee->mandant_party_id);
        }

        $monnaie = Currencies::of($devise);
        $reste = new Money($montant, $monnaie);
        $parts = [];

        foreach ($this->avances->available($leaseId, $monnaie) as $avance) {
            if (! $reste->isPositive()) {
                break;
            }

            $part = $avance['remaining']->lessThan($reste) ? $avance['remaining'] : $reste;
            $parts[] = ['payment' => $avance['payment'], 'amount' => $part];
            $reste = $reste->subtract($part);
        }

        if ($reste->isPositive()) {
            throw ErrorCode::AdvanceInsufficient->problem();
        }

        $source = $routee !== null && $this->lecteur->ownerFundsCutoverAt() !== null ? AccountRole::TrustBank : AccountRole::Bank;
        $locataire = $parts[0]['payment']->party_id;
        $unite = Installment::query()->where('lease_id', $leaseId)->orderByDesc('period_start')->value('unit_id');
        $premier = (string) Str::uuid7();
        $total = new Money($montant, $monnaie);

        $ecriture = $this->livre->post(new EntryData(
            Journal::Bank,
            $date,
            sprintf('Remboursement d\'avance du bail %s', $referenceBail),
            SourceType::Adjustment,
            $premier,
            "rent:refund:{$premier}",
            [
                LineData::debit(AccountRole::TenantReceivable, $total, $leaseId, $locataire, is_string($unite) ? $unite : null),
                LineData::credit($source, $total, $leaseId, $locataire),
            ],
            OnClosedPeriod::RollForward,
        ));

        $lignes = [];

        foreach ($parts as $i => $part) {
            $ligne = new AdvanceRefund;
            $ligne->forceFill([
                'id' => $i === 0 ? $premier : (string) Str::uuid7(),
                'lease_id' => $leaseId,
                'payment_id' => $part['payment']->id,
                'amount' => $part['amount'],
                'currency' => $devise,
                'refunded_on' => $date->toDateString(),
                'source' => $source === AccountRole::TrustBank ? 'trust' : 'bank',
                'reference' => $reference,
                'ledger_entry_id' => $ecriture->id,
                'idempotency_key' => $cle,
                'fingerprint' => $empreinte,
                'recorded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ])->save();
            $lignes[] = $ligne;
        }

        $this->audit->handle('rent.refund.recorded', subject: $lignes[0], metadata: ['slices' => count($lignes), 'source' => $lignes[0]->source, 'ledger_entry_id' => $ecriture->id]);

        return new RefundedAdvance($lignes, $total, false);
    }

    private function existing(string $cle, string $empreinte): ?RefundedAdvance
    {
        $lignes = AdvanceRefund::query()->where('idempotency_key', $cle)->orderBy('created_at')->orderBy('id')->get();

        if ($lignes->isEmpty()) {
            return null;
        }

        if (! hash_equals((string) $lignes->first()->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        $total = $lignes->first()->amount->multiply(0);

        foreach ($lignes as $ligne) {
            $total = $total->add($ligne->amount);
        }

        return new RefundedAdvance(array_values($lignes->all()), $total, true);
    }
}
