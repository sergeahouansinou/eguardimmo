<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\PublicApi\ManagementFeeInvoices;
use App\Modules\Mandates\Data\MandateFeeScheduleData;
use App\Modules\Mandates\Data\MandateFeeTermData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Data\FeeAmountsData;
use App\Modules\OwnerFunds\Data\FeeProposalData;
use App\Modules\OwnerFunds\Data\FeeResultData;
use App\Modules\OwnerFunds\Data\FeeSegmentData;
use App\Modules\OwnerFunds\Data\FeeSimulationMonthData;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Models\FeeStatement;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Honoraires d'un mandat sous un barème proposé, sur les derniers mois clos : lecture seule, rien n'est posé ni journalisé.
 */
final readonly class FeeSimulator
{
    public function __construct(
        private LedgerAggregates $agregats,
        private LedgerReader $lecteur,
        private MandateDirectory $mandats,
        private FeeMovements $mouvements,
        private FeeCalculator $calcul,
        private ManagementFeeInvoices $factures,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @return list<FeeSimulationMonthData> du plus ancien au plus récent mois clos retenu ; vide sans mois clos
     */
    public function simulate(string $mandateId, FeeProposalData $proposition, int $mois, CarbonImmutable $today): array
    {
        $mandat = $this->mandate($mandateId);
        $clos = $this->lastClosedMonths($mois);

        if ($clos === []) {
            return [];
        }

        $devise = $this->organisations->currency();
        $taux = $this->factures->vatRatePcm($today);
        $lignes = [];

        foreach ($clos as $periode) {
            $ligne = $this->month($mandat, $periode, $proposition, $taux, $devise);

            if ($ligne !== null) {
                $lignes[] = $ligne;
            }
        }

        return $lignes;
    }

    private function mandate(string $mandateId): MandateFeeScheduleData
    {
        return $this->mandats->feeSchedules('9999-12-31', $mandateId)[0] ?? throw ErrorCode::MandateNotFound->problem();
    }

    /**
     * @return list<AccountingPeriodData>
     */
    private function lastClosedMonths(int $nombre): array
    {
        $activation = $this->lecteur->ownerFundsCutoverAt();

        if ($activation === null) {
            return [];
        }

        $debut = $activation->startOfMonth();
        $clos = array_values(array_filter($this->agregats->periods(), fn (AccountingPeriodData $p): bool => $p->start->greaterThanOrEqualTo($debut)));

        return array_slice($clos, -$nombre);
    }

    private function month(MandateFeeScheduleData $mandat, AccountingPeriodData $periode, FeeProposalData $proposition, int $taux, Currency $devise): ?FeeSimulationMonthData
    {
        $dernierJour = $periode->end->subDay();

        if ($mandat->startsOn > $dernierJour->toDateString()) {
            return null;
        }

        $actifs = $this->mouvements->schedules($mandat->mandantPartyId, $dernierJour);
        $parMandat = $this->mouvements->byMandate($mandat->mandantPartyId, $actifs, $devise, $periode->start, $dernierJour);
        $courant = null;

        foreach ($actifs as $actif) {
            $actif->mandateId === $mandat->mandateId && $courant = $actif;
        }

        $segments = $courant === null ? null : $this->mouvements->segments($courant, $parMandat[$mandat->mandateId] ?? [], $dernierJour);
        $loyer = $segments === null ? 0 : array_sum(array_map(fn (FeeSegmentData $s): int => $s->rent, $segments));
        $charges = $segments === null ? 0 : array_sum(array_map(fn (FeeSegmentData $s): int => $s->charges, $segments));

        return new FeeSimulationMonthData(
            $periode->start->format('Y-m'),
            $loyer,
            $charges,
            $this->current($mandat->mandateId, $periode, $segments, $taux, $devise),
            $this->proposed($proposition, $periode, $loyer, $charges, $taux, $devise),
        );
    }

    /**
     * @param  non-empty-list<FeeSegmentData>|null  $segments
     */
    private function current(string $mandateId, AccountingPeriodData $periode, ?array $segments, int $taux, Currency $devise): ?FeeAmountsData
    {
        $releve = FeeStatement::query()->where('mandate_id', $mandateId)->where('period_start', $periode->start->toDateString())->first();

        if ($releve !== null) {
            return new FeeAmountsData('statement', (int) $releve->fee_net->getAmount(), (int) $releve->tax_amount->getAmount(), (int) $releve->fee_total->getAmount(), $releve->minimum_applied);
        }

        if ($segments === null) {
            return new FeeAmountsData('computed', 0, 0, 0, false);
        }

        foreach ($segments as $segment) {
            if (($segment->rent !== 0 || $segment->charges !== 0) && $segment->term->feeBase === null) {
                return null;
            }
        }

        return $this->amounts('computed', $this->calcul->compute($segments, $taux, $devise));
    }

    private function proposed(FeeProposalData $proposition, AccountingPeriodData $periode, int $loyer, int $charges, int $taux, Currency $devise): FeeAmountsData
    {
        $bareme = new MandateFeeTermData(
            'simulation', $periode->start->toDateString(), null, $proposition->feeKind, $proposition->feeBasisPoints, $proposition->feeFlatAmount,
            $proposition->feeBase, $proposition->feeMinimumAmount, $proposition->feeTaxMode,
        );

        return $this->amounts('simulation', $this->calcul->compute([new FeeSegmentData($bareme, $loyer, $charges)], $taux, $devise));
    }

    private function amounts(string $source, FeeResultData $resultat): FeeAmountsData
    {
        return new FeeAmountsData($source, $resultat->net, $resultat->tax, $resultat->gross, $resultat->minimumApplied);
    }
}
