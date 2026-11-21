<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Data\ReportLineInput;
use App\Modules\Reporting\Data\ReportPeriod;
use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;
use App\Modules\Reporting\Enums\PeriodKind;
use App\Modules\Reporting\Support\FiguresReader;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Loyers d'un mois par mandant et par lot, lus au grand livre comme un compte rendu (mêmes chiffres, ADR 0030). Chaque couple
 * (agence, mandant) est lu dans sa propre organisation et sa propre devise : aucun total ne traverse deux agences ni deux mandants.
 */
final readonly class OwnerRent
{
    private const array ZERO = ['called' => 0, 'collected' => 0, 'fees' => 0, 'works' => 0, 'net' => 0];

    public function __construct(
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private MandateDirectory $mandats,
        private UnitDirectory $lots,
        private LeaseDirectory $baux,
        private LedgerAggregates $grandLivre,
        private FiguresReader $chiffres,
    ) {}

    /**
     * @return list<array{visible: OwnerVisibleData, agency_name: string|null, currency: string, units: list<array{unit: UnitData, amounts: array<string, int>, arrears: int|null}>, others: array<string, int>, totals: array<string, int>}>
     */
    public function month(OwnerScopeData $portee, CarbonImmutable $debut, CarbonImmutable $fin): array
    {
        $noms = $this->organisations->names($portee->organizationIds());
        $mois = [];

        foreach ($portee->visibles as $visible) {
            $mois[] = $this->contexte->run($visible->organizationId, fn (): array => $this->mandant($portee, $visible, $noms[$visible->organizationId] ?? null, $debut, $fin));
        }

        return $mois;
    }

    /**
     * @return array{visible: OwnerVisibleData, agency_name: string|null, currency: string, units: list<array{unit: UnitData, amounts: array<string, int>, arrears: int|null}>, others: array<string, int>, totals: array<string, int>}
     */
    private function mandant(OwnerScopeData $portee, OwnerVisibleData $visible, ?string $agence, CarbonImmutable $debut, CarbonImmutable $fin): array
    {
        $devise = $this->organisations->currency();
        $vide = ['visible' => $visible, 'agency_name' => $agence, 'currency' => $devise->getCode(), 'units' => [], 'others' => self::ZERO, 'totals' => self::ZERO];
        $spans = array_values(array_filter(
            $this->mandats->coverageDuring($debut, $fin, [$visible->mandantPartyId]),
            fn (MandateSpanData $s): bool => $this->visibleDansLaFenetre($portee, $visible, $s),
        ));

        if ($spans === []) {
            return $vide;
        }

        $lotIds = array_values(array_unique(array_map(fn (MandateSpanData $s): string => $s->unitId, $spans)));
        $lots = $this->lots->findMany($lotIds);
        $references = array_map(fn (UnitData $u): string => $u->reference, $lots);
        $chiffres = $this->chiffres->read($visible->mandantPartyId, $devise, new ReportPeriod(PeriodKind::Monthly, $debut, $fin), $spans, $references);

        $parLot = array_fill_keys($lotIds, self::ZERO);
        $autres = self::ZERO;

        foreach ($chiffres->lines as $ligne) {
            if ($ligne->unitId !== null && isset($parLot[$ligne->unitId])) {
                $parLot[$ligne->unitId] = $this->cumuler($parLot[$ligne->unitId], $ligne);
            } else {
                $autres = $this->cumuler($autres, $ligne);
            }
        }

        $dettes = $this->arrears($spans, $devise, $fin);
        $unites = [];
        $totaux = $this->net($autres);

        foreach ($lotIds as $lot) {
            if (! isset($lots[$lot])) {
                continue;
            }

            $montants = $this->net($parLot[$lot]);
            $unites[] = ['unit' => $lots[$lot], 'amounts' => $montants, 'arrears' => $dettes[$lot] ?? null];
            $totaux = $this->additionner($totaux, $montants);
        }

        return [...$vide, 'units' => $unites, 'others' => $this->net($autres), 'totals' => $totaux];
    }

    private function visibleDansLaFenetre(OwnerScopeData $portee, OwnerVisibleData $visible, MandateSpanData $span): bool
    {
        foreach ($portee->coverages as $couverture) {
            if ($couverture->organizationId === $visible->organizationId
                && $couverture->mandantPartyId === $visible->mandantPartyId
                && $couverture->unitId === $span->unitId
                && $couverture->from <= $span->to
                && $couverture->to >= $span->from) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, int>  $cumul
     * @return array<string, int>
     */
    private function cumuler(array $cumul, ReportLineInput $ligne): array
    {
        $signe = $ligne->direction === LineDirection::Credit ? 1 : -1;

        match ($ligne->kind) {
            LineKind::RentCalled => $cumul['called'] += $signe * $ligne->amount,
            LineKind::RentCollected, LineKind::Advance => $cumul['collected'] += $signe * $ligne->amount,
            LineKind::Fee, LineKind::FeeVat => $cumul['fees'] -= $signe * $ligne->amount,
            LineKind::Works => $cumul['works'] -= $signe * $ligne->amount,
            default => null,
        };

        return $cumul;
    }

    /**
     * @param  array<string, int>  $montants
     * @return array<string, int>
     */
    private function net(array $montants): array
    {
        $montants['net'] = $montants['collected'] - $montants['fees'] - $montants['works'];

        return $montants;
    }

    /**
     * @param  array<string, int>  $a
     * @param  array<string, int>  $b
     * @return array<string, int>
     */
    private function additionner(array $a, array $b): array
    {
        $somme = [];

        foreach ($a as $cle => $valeur) {
            $somme[$cle] = $valeur + ($b[$cle] ?? 0);
        }

        return $somme;
    }

    /**
     * Reste dû du bail principal de chaque lot au dernier jour couvert du mois (fin du mois au plus tard) : le retard, seule donnée de
     * paiement du locataire communiquée. Un lot passé à un autre mandant en cours de mois n'expose pas le locataire suivant.
     *
     * @param  list<MandateSpanData>  $spans
     * @return array<string, int>
     */
    private function arrears(array $spans, Currency $devise, CarbonImmutable $fin): array
    {
        $derniers = [];

        foreach ($spans as $span) {
            $derniers[$span->unitId] = max($derniers[$span->unitId] ?? $span->to, $span->to);
        }

        $parJour = [];

        foreach ($derniers as $lot => $jour) {
            $parJour[min($jour, $fin->toDateString())][] = $lot;
        }

        $retards = [];

        foreach ($parJour as $jour => $lots) {
            $date = $jour === $fin->toDateString() ? $fin : CarbonImmutable::parse($jour);
            $retards += $this->arrearsAt($lots, $devise, $date);
        }

        return $retards;
    }

    /**
     * @param  list<string>  $lotIds
     * @return array<string, int>
     */
    private function arrearsAt(array $lotIds, Currency $devise, CarbonImmutable $jour): array
    {
        $baux = [];

        foreach ($this->baux->occupancyAt($lotIds, $jour) as $occupation) {
            if (! isset($baux[$occupation->unitId]) || $occupation->isMain) {
                $baux[$occupation->unitId] = $occupation->leaseId;
            }
        }

        if ($baux === []) {
            return [];
        }

        $dus = $this->grandLivre->dueByLeases(array_values(array_unique($baux)), $devise, $jour);

        return array_map(fn (string $bail): int => isset($dus[$bail]) ? (int) $dus[$bail]->getAmount() : 0, $baux);
    }
}
