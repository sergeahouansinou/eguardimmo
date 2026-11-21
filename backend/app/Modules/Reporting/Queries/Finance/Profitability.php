<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Finance;

use App\Modules\Investments\Data\AcquisitionData;
use App\Modules\Investments\PublicApi\Acquisitions;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\ProfitabilityFigures;
use App\Modules\Reporting\Support\Finance\PropertyNames;
use Carbon\CarbonImmutable;

/**
 * Rentabilité d'une année civile, avant impôt, par bien ou par lot selon le niveau du coût de revient. Brut : loyers encaissés hors charges
 * sur le prix de revient ; net : moins les dépenses non récupérées payées, hors intérêts ; net après financement : moins intérêts, assurance
 * et frais d'emprunt. Points de base entiers, demi supérieur ; sans coût de revient, `null` et le motif `cost_missing`. Jamais annualisée.
 *
 * @phpstan-type MoneyView array{amount: int, currency: string}
 * @phpstan-type Row array{level: string, property_id: string, property_name: ?string, unit_id: ?string, unit_reference: ?string, cost: ?MoneyView, acquired_on: ?string, partial_ownership: bool, rent_collected: MoneyView, expenses_unrecovered: MoneyView, financing: array{interest: MoneyView, insurance: MoneyView, fees: MoneyView, total: MoneyView}, gross_bp: ?int, net_bp: ?int, net_after_financing_bp: ?int, reason: ?string}
 */
final readonly class Profitability
{
    public function __construct(
        private ProfitabilityFigures $chiffres,
        private Acquisitions $acquisitions,
        private OrganizationDirectory $organisations,
        private UnitDirectory $lots,
        private PropertyNames $noms,
    ) {}

    /**
     * @return array{year: int, currency: string, from: string, to: string, partial: bool, assumptions: array<string, mixed>, rows: list<Row>, warnings: list<array<string, mixed>>}
     */
    public function of(int $year, CarbonImmutable $today): array
    {
        $devise = $this->organisations->currency();
        $code = $devise->getCode();
        $faits = $this->chiffres->of($year, $devise);
        $debut = CarbonImmutable::createFromDate($year, 1, 1)->startOfDay();
        $fin = $debut->addYear();
        $coutsParBien = [];

        foreach ($this->acquisitions->forProperties() as $a) {
            $coutsParBien[$a->propertyId][$a->unitId ?? ''] = $a;
        }

        $perimetres = $this->scopes($faits, $coutsParBien);
        $biens = array_values(array_unique(array_map(fn (array $p): string => $p['property'], $perimetres)));
        $noms = $this->noms->of($biens);
        $unites = $this->unitNames(array_values(array_filter(array_map(fn (array $p): string => $p['unit'], $perimetres), fn (string $u): bool => $u !== '')));
        $lignes = [];
        $avertissements = [];

        foreach ($perimetres as $p) {
            $lignes[] = $this->row($p, $faits, $code, $debut, $fin, $noms, $unites);
        }

        foreach ($this->unallocated($faits, $perimetres) as [$bien, $montant]) {
            $avertissements[] = ['code' => 'unallocated_amounts', 'property_id' => $bien, 'amount' => Amounts::view($montant, $code)];
        }

        $faits['unattributed'] === 0 || $avertissements[] = ['code' => 'unattributed_expenses', 'property_id' => null, 'amount' => Amounts::view($faits['unattributed'], $code)];

        return [
            'year' => $year,
            'currency' => $code,
            'from' => $debut->toDateString(),
            'to' => $fin->subDay()->toDateString(),
            'partial' => $year === $today->year,
            'assumptions' => [
                'before_tax' => true,
                'rent' => 'collected_excluding_charges',
                'expenses' => 'paid_unrecovered_excluding_loan_interest',
                'financing' => 'interest_insurance_fees',
                'rounding' => 'half_up_basis_points',
                'annualized' => false,
                'cost_basis' => 'acquisition_price_costs_agency_fees_initial_works',
            ],
            'rows' => $lignes,
            'warnings' => $avertissements,
        ];
    }

    /**
     * Un périmètre par bien entier (coût du bien, ou sans coût) ou par lot (coût de lot, ou lot sans coût qui a des faits).
     *
     * @param  array{rent: array<string, int>, expenses: array<string, int>, financing: array<string, array{interest: int, insurance: int, fees: int}>, unattributed: int}  $faits
     * @param  array<string, array<string, AcquisitionData>>  $couts
     * @return list<array{property: string, unit: string, acquisition: ?AcquisitionData}>
     */
    private function scopes(array $faits, array $couts): array
    {
        $cles = array_unique([...array_keys($faits['rent']), ...array_keys($faits['expenses']), ...array_keys($faits['financing'])]);
        $biens = array_keys($couts);

        foreach ($cles as $cle) {
            $biens[] = explode('|', $cle)[0];
        }

        $perimetres = [];

        foreach (array_unique($biens) as $bien) {
            $coutsDuBien = $couts[$bien] ?? [];

            if ($coutsDuBien === [] || isset($coutsDuBien[''])) {
                $perimetres[$bien.'|'] = ['property' => $bien, 'unit' => '', 'acquisition' => $coutsDuBien[''] ?? null];

                continue;
            }

            foreach ($coutsDuBien as $lot => $acquisition) {
                $perimetres[$bien.'|'.$lot] = ['property' => $bien, 'unit' => (string) $lot, 'acquisition' => $acquisition];
            }

            foreach ($cles as $cle) {
                [$b, $lot] = explode('|', $cle);

                if ($b === $bien && $lot !== '' && ! isset($coutsDuBien[$lot])) {
                    $perimetres[$bien.'|'.$lot] = ['property' => $bien, 'unit' => $lot, 'acquisition' => null];
                }
            }
        }

        ksort($perimetres);

        return array_values($perimetres);
    }

    /**
     * @param  array{property: string, unit: string, acquisition: ?AcquisitionData}  $p
     * @param  array{rent: array<string, int>, expenses: array<string, int>, financing: array<string, array{interest: int, insurance: int, fees: int}>, unattributed: int}  $faits
     * @param  array<string, string>  $noms
     * @param  array<string, string>  $unites
     * @return Row
     */
    private function row(array $p, array $faits, string $code, CarbonImmutable $debut, CarbonImmutable $fin, array $noms, array $unites): array
    {
        $loyer = 0;
        $depenses = 0;
        $interets = 0;
        $assurance = 0;
        $frais = 0;

        foreach ($this->factKeys($p, $faits) as $cle) {
            $loyer += $faits['rent'][$cle] ?? 0;
            $depenses += $faits['expenses'][$cle] ?? 0;
            $interets += $faits['financing'][$cle]['interest'] ?? 0;
            $assurance += $faits['financing'][$cle]['insurance'] ?? 0;
            $frais += $faits['financing'][$cle]['fees'] ?? 0;
        }

        $acquisition = $p['acquisition'];
        $cout = $acquisition === null ? null : Amounts::minor($acquisition->cost);
        $motif = $acquisition === null || $cout === null || $cout <= 0 ? 'cost_missing' : ($acquisition->acquiredOn >= $fin->toDateString() ? 'not_yet_acquired' : null);
        $net = $loyer - $depenses;
        $financement = $interets + $assurance + $frais;

        return [
            'level' => $p['unit'] === '' ? 'property' : 'unit',
            'property_id' => $p['property'],
            'property_name' => $noms[$p['property']] ?? null,
            'unit_id' => $p['unit'] === '' ? null : $p['unit'],
            'unit_reference' => $p['unit'] === '' ? null : ($unites[$p['unit']] ?? null),
            'cost' => $cout === null ? null : Amounts::view($cout, $code),
            'acquired_on' => $acquisition?->acquiredOn,
            'partial_ownership' => $acquisition !== null && $acquisition->acquiredOn > $debut->toDateString(),
            'rent_collected' => Amounts::view($loyer, $code),
            'expenses_unrecovered' => Amounts::view($depenses, $code),
            'financing' => ['interest' => Amounts::view($interets, $code), 'insurance' => Amounts::view($assurance, $code), 'fees' => Amounts::view($frais, $code), 'total' => Amounts::view($financement, $code)],
            'gross_bp' => $motif === null ? Amounts::basisPoints($loyer, (int) $cout) : null,
            'net_bp' => $motif === null ? Amounts::basisPoints($net, (int) $cout) : null,
            'net_after_financing_bp' => $motif === null ? Amounts::basisPoints($net - $financement, (int) $cout) : null,
            'reason' => $motif,
        ];
    }

    /**
     * @param  array{property: string, unit: string, acquisition: ?AcquisitionData}  $p
     * @param  array{rent: array<string, int>, expenses: array<string, int>, financing: array<string, array{interest: int, insurance: int, fees: int}>, unattributed: int}  $faits
     * @return list<string>
     */
    private function factKeys(array $p, array $faits): array
    {
        if ($p['unit'] !== '') {
            return [$p['property'].'|'.$p['unit']];
        }

        $cles = [];

        foreach ([...array_keys($faits['rent']), ...array_keys($faits['expenses']), ...array_keys($faits['financing'])] as $cle) {
            if (str_starts_with($cle, $p['property'].'|')) {
                $cles[$cle] = $cle;
            }
        }

        return array_values($cles);
    }

    /**
     * Faits sans lot d'un bien suivi lot par lot : aucun lot ne les porte, ils sont signalés et jamais répartis.
     *
     * @param  array{rent: array<string, int>, expenses: array<string, int>, financing: array<string, array{interest: int, insurance: int, fees: int}>, unattributed: int}  $faits
     * @param  list<array{property: string, unit: string, acquisition: ?AcquisitionData}>  $perimetres
     * @return list<array{string, int}>
     */
    private function unallocated(array $faits, array $perimetres): array
    {
        $parLot = array_unique(array_map(fn (array $p): string => $p['property'], array_filter($perimetres, fn (array $p): bool => $p['unit'] !== '')));
        $sortie = [];

        foreach ($parLot as $bien) {
            $cle = $bien.'|';
            $montant = ($faits['expenses'][$cle] ?? 0) + array_sum($faits['financing'][$cle] ?? []);

            $montant === 0 || $sortie[] = [$bien, $montant];
        }

        return $sortie;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function unitNames(array $ids): array
    {
        $noms = [];

        foreach ($this->lots->findMany($ids) as $id => $lot) {
            $noms[$id] = $lot->reference;
        }

        return $noms;
    }
}
