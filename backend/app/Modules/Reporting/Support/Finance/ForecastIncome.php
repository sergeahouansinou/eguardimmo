<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Reporting\Data\ForecastAssumptionsData;
use App\Modules\Reporting\Enums\ErrorCode;
use Carbon\CarbonImmutable;

/**
 * Loyers et provisions attendus des baux en cours : lignes du bail en vigueur chaque jour, au prorata des jours du mois, fin de bail
 * respectée, aucun renouvellement supposé. Indexation hypothétique au mois anniversaire des lignes indexées que le bail n'a pas déjà
 * révisées ; jours de vacance saisis retirés. Hypothèses de l'utilisateur : ni indice officiel, ni échéance réelle.
 */
final readonly class ForecastIncome
{
    private const int PAGE = 500;

    private const int PAGES_MAX = 20;

    private const array LOYERS = [LeaseComponentSemantic::Rent, LeaseComponentSemantic::RentSupplement];

    private const array CHARGES = [LeaseComponentSemantic::ChargesProvision, LeaseComponentSemantic::ChargesFlat];

    public function __construct(private LeaseSchedule $echeancier, private LeaseDirectory $baux) {}

    /**
     * @return array{months: array<string, array{rent: int, charges: int}>, foreign_currency_leases: int}
     */
    public function between(CarbonImmutable $from, CarbonImmutable $toExclusive, string $devise, ForecastAssumptionsData $hypotheses): array
    {
        $mois = [];

        foreach (Months::between($from, $toExclusive) as $m) {
            $mois[$m] = ['rent' => 0, 'charges' => 0];
        }

        $etrangers = 0;
        $dernierId = null;

        for ($page = 0; $page < self::PAGES_MAX; $page++) {
            $baux = $this->echeancier->activeBetween($from, $toExclusive->subDay(), $dernierId, self::PAGE);
            $actifs = array_values(array_filter($baux, fn (LeaseBillingData $b): bool => $b->currency === $devise));
            $etrangers += count($baux) - count($actifs);
            $ids = array_map(fn (LeaseBillingData $b): string => $b->leaseId, $actifs);
            $lignes = $this->echeancier->linesBetweenMany($ids, $from, $toExclusive->subDay());
            $vacances = $hypotheses->vacancies === [] ? [] : $this->vacanciesByLease($ids, $hypotheses);

            foreach ($actifs as $bail) {
                $this->add($mois, $bail, $lignes[$bail->leaseId] ?? [], $vacances[$bail->leaseId] ?? [], $hypotheses);
            }

            if (count($baux) < self::PAGE) {
                return ['months' => $mois, 'foreign_currency_leases' => $etrangers];
            }

            $dernierId = $baux[count($baux) - 1]->leaseId;
        }

        throw ErrorCode::FinanceTooLarge->problem();
    }

    /**
     * @param  array<string, array{rent: int, charges: int}>  $mois
     * @param  list<LeaseTermLineData>  $lignes
     * @param  list<array{unit_id: string, from: string, to: string}>  $vacances
     */
    private function add(array &$mois, LeaseBillingData $bail, array $lignes, array $vacances, ForecastAssumptionsData $hypotheses): void
    {
        $anniversaire = $hypotheses->indexationMilli > 0 ? $this->anniversary(array_keys($mois), CarbonImmutable::parse($bail->startsOn)) : null;

        foreach (array_keys($mois) as $m) {
            $debut = CarbonImmutable::createFromFormat('!Y-m', $m);

            if ($debut === null) {
                continue;
            }

            $jours = $this->paidDays($bail, $debut, $vacances);

            if ($jours === []) {
                continue;
            }

            foreach ($lignes as $ligne) {
                $nature = in_array($ligne->semantic, self::LOYERS, true) ? 'rent' : (in_array($ligne->semantic, self::CHARGES, true) ? 'charges' : null);
                $nombre = count(array_filter($jours, fn (string $j): bool => $j >= $ligne->validFrom && ($ligne->validTo === null || $j < $ligne->validTo)));

                if ($nature === null || $nombre === 0) {
                    continue;
                }

                $montant = Amounts::minor($ligne->amount);

                if ($anniversaire !== null && $m >= $anniversaire && $ligne->indexed && $ligne->validFrom < $anniversaire.'-01') {
                    $montant = Amounts::divide($montant * (ForecastAssumptionsData::PERCENT_SCALE + $hypotheses->indexationMilli), ForecastAssumptionsData::PERCENT_SCALE);
                }

                $mois[$m][$nature] += Amounts::divide($montant * $nombre, $debut->daysInMonth);
            }
        }
    }

    /**
     * Premier mois de la fenêtre qui porte le mois du début de bail, une année au moins après celui-ci.
     *
     * @param  list<string>  $mois
     */
    private function anniversary(array $mois, CarbonImmutable $debutBail): ?string
    {
        foreach ($mois as $m) {
            if (substr($m, 5, 2) === $debutBail->format('m') && $m > $debutBail->format('Y-m')) {
                return $m;
            }
        }

        return null;
    }

    /**
     * Jours (`Y-m-d`) du mois couverts par le bail et hors vacance saisie.
     *
     * @param  list<array{unit_id: string, from: string, to: string}>  $vacances
     * @return list<string>
     */
    private function paidDays(LeaseBillingData $bail, CarbonImmutable $debut, array $vacances): array
    {
        $payes = [];
        $fin = $debut->addMonthNoOverflow();

        for ($jour = $debut; $jour->lessThan($fin); $jour = $jour->addDay()) {
            $texte = $jour->toDateString();

            if ($texte < $bail->startsOn || ($bail->effectiveEndsOn !== null && $texte >= $bail->effectiveEndsOn)) {
                continue;
            }

            foreach ($vacances as $v) {
                if ($texte >= $v['from'] && $texte <= $v['to']) {
                    continue 2;
                }
            }

            $payes[] = $texte;
        }

        return $payes;
    }

    /**
     * @param  list<string>  $leaseIds
     * @return array<string, list<array{unit_id: string, from: string, to: string}>> vacances des lots principaux de chaque bail
     */
    private function vacanciesByLease(array $leaseIds, ForecastAssumptionsData $hypotheses): array
    {
        $parBail = [];

        foreach ($this->baux->findMany($leaseIds) as $bail) {
            $principaux = array_map(fn (LeaseUnitData $l): string => $l->unitId, array_filter($bail->units, fn (LeaseUnitData $l): bool => $l->isMain));
            $parBail[$bail->id] = array_values(array_filter($hypotheses->vacancies, fn (array $v): bool => in_array($v['unit_id'], $principaux, true)));
        }

        return $parBail;
    }
}
