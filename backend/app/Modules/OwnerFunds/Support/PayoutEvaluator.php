<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Invoicing\PublicApi\ManagementFeeInvoices;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Data\PayoutEvaluationData;
use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Models\FeeStatement;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\Parties\Data\PayoutAccountData;
use App\Modules\Parties\PublicApi\PartyDirectory;
use Carbon\CarbonImmutable;

/**
 * Net reversable d'un mandant et motif d'exclusion éventuel (ADR 0031, décision 4). Lecture seule : aucune écriture.
 */
final readonly class PayoutEvaluator
{
    private const int DIVISEUR_TAUX = 100_000;

    public function __construct(
        private LedgerAggregates $agregats,
        private FeeBilling $honoraires,
        private FeeMovements $mouvements,
        private ManagementFeeInvoices $factures,
        private PartyDirectory $parties,
        private OrganizationDirectory $organisations,
    ) {}

    public function evaluate(string $mandantId, CarbonImmutable $today): PayoutEvaluationData
    {
        $fonds = $this->agregats->ownerFunds([$mandantId], $this->organisations->currency(), $today)[$mandantId] ?? null;
        $payable = $fonds === null ? 0 : (int) $fonds->payable->getAmount();
        $transit = $fonds === null ? 0 : (int) $fonds->inTransit->getAmount();
        $appele = $fonds === null ? 0 : (int) $fonds->called->getAmount();
        [$bloque, $reserve] = $this->holds($mandantId);
        [$dus, $rendu] = $this->dues($mandantId, $today);
        $estimes = $this->honoraires->estimate($mandantId, $today);
        $net = $bloque ? 0 : max(0, $payable + $rendu - $dus - $estimes - $reserve);
        $compte = $this->parties->payoutAccount($mandantId, $today);

        return new PayoutEvaluationData(
            $mandantId, $payable, $transit, $appele, $dus, $estimes, $reserve, $bloque, $net, $compte,
            $this->reason($mandantId, $today, $payable, $net, $bloque, $compte),
        );
    }

    /**
     * @return array{0: bool, 1: int} blocage total, somme des retenues partielles
     */
    public function holds(string $mandantId): array
    {
        $bloque = false;
        $reserve = 0;

        foreach (PayoutHold::query()->where('mandant_party_id', $mandantId)->whereNull('released_at')->get() as $retenue) {
            if ($retenue->kind === HoldKind::Full) {
                $bloque = true;
            } elseif ($retenue->amount !== null) {
                $reserve += (int) $retenue->amount->getAmount();
            }
        }

        return [$bloque, $reserve];
    }

    /**
     * Honoraires TTC à régler une fois le plan posé : un avoir de mois en recul s'impute d'abord sur ce qui est dû ;
     * le surplus est rendu au compte du mandant.
     *
     * @return array{0: int, 1: int} dû, rendu au mandant
     */
    private function dues(string $mandantId, CarbonImmutable $today): array
    {
        $dus = $this->openInvoices($mandantId);
        $rendu = 0;
        $taux = $this->factures->vatRatePcm($today);

        foreach ($this->honoraires->plan($mandantId, $today) as $item) {
            if ($item->adjustedNet > 0) {
                $dus += $item->adjustedGross;

                continue;
            }

            if ($item->adjustedNet < 0) {
                $credit = -$item->adjustedNet + intdiv(-$item->adjustedNet * $taux + intdiv(self::DIVISEUR_TAUX, 2), self::DIVISEUR_TAUX);
                $impute = min($dus, $credit);
                $dus -= $impute;
                $rendu += $credit - $impute;
            }
        }

        return [$dus, $rendu];
    }

    private function openInvoices(string $mandantId): int
    {
        $total = 0;

        foreach (FeeStatement::query()->where('mandant_party_id', $mandantId)->whereNotNull('invoice_id')->pluck('invoice_id') as $factureId) {
            $total += $this->factures->outstanding((string) $factureId);
        }

        return $total;
    }

    private function reason(string $mandantId, CarbonImmutable $today, int $payable, int $net, bool $bloque, ?PayoutAccountData $compte): ?ExclusionReason
    {
        $minimum = (int) config('owner_funds.payout_minimum_minor');
        $jourReversement = $this->payoutDay($mandantId, $today);

        return match (true) {
            $payable < 0 => ExclusionReason::NegativeBalance,
            $bloque => ExclusionReason::ActiveHold,
            $compte === null => ExclusionReason::NoPayoutAccount,
            $compte->recordedAt->greaterThan($today->subDays((int) config('owner_funds.account_cooling_days'))) => ExclusionReason::AccountRecentlyChanged,
            $net <= 0 => ExclusionReason::NothingToPay,
            $net < $minimum => ExclusionReason::BelowMinimum,
            $jourReversement !== null && $today->day < $jourReversement => ExclusionReason::BeforePayoutDay,
            default => null,
        };
    }

    private function payoutDay(string $mandantId, CarbonImmutable $today): ?int
    {
        $jour = $today->toDateString();
        $minimum = null;

        foreach ($this->mouvements->schedules($mandantId, $today) as $mandat) {
            if ($mandat->startsOn > $jour || $jour >= $mandat->endsOn) {
                continue;
            }

            foreach ($mandat->terms as $bareme) {
                if ($bareme->payoutDay !== null && $bareme->validFrom <= $jour && ($bareme->validTo === null || $jour < $bareme->validTo)) {
                    $minimum = $minimum === null ? $bareme->payoutDay : min($minimum, $bareme->payoutDay);
                }
            }
        }

        return $minimum;
    }
}
