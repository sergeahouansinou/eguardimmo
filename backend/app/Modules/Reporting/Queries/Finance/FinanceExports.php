<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Finance;

use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\PropertyNames;
use Carbon\CarbonImmutable;

/**
 * Lignes des exports CSV financiers (en-tête comprise) : montants en unités mineures, rendements en points de base, aucune référence de
 * contrat ni libellé de prêteur.
 */
final readonly class FinanceExports
{
    public function __construct(
        private LoanCosts $prets,
        private Profitability $rentabilite,
        private PropertyNames $noms,
        private UnitDirectory $lots,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @return list<list<string|int>>
     */
    public function loans(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $echeances = $this->prets->installments($from, $to->addDay());
        $noms = $this->noms->of(array_map(fn ($e): string => $e->propertyId, $echeances));
        $lots = $this->unitReferences(array_values(array_filter(array_map(fn ($e): ?string => $e->unitId, $echeances))));
        $lignes = [['bien', 'lot', 'echeance', 'mensualite_minor', 'interets_minor', 'assurance_minor', 'total_minor', 'devise']];

        foreach ($echeances as $e) {
            $paiement = Amounts::minor($e->payment);
            $assurance = Amounts::minor($e->insurance);
            $lignes[] = [$noms[$e->propertyId] ?? '', $e->unitId === null ? '' : ($lots[$e->unitId] ?? ''), $e->dueOn, $paiement, Amounts::minor($e->interest), $assurance, $paiement + $assurance, $e->payment->getCurrency()->getCode()];
        }

        return $lignes;
    }

    /**
     * @return list<list<string|int>>
     */
    public function profitability(int $year, CarbonImmutable $today): array
    {
        $vue = $this->rentabilite->of($year, $today);
        $devise = $this->organisations->currency()->getCode();
        $lignes = [['bien', 'lot', 'niveau', 'cout_revient_minor', 'loyers_encaisses_minor', 'depenses_non_recuperees_minor', 'interets_minor', 'assurance_minor', 'frais_minor', 'brut_pdb', 'net_pdb', 'net_apres_financement_pdb', 'motif', 'devise']];

        foreach ($vue['rows'] as $r) {
            $lignes[] = [
                (string) ($r['property_name'] ?? ''), (string) ($r['unit_reference'] ?? ''), (string) $r['level'],
                $r['cost']['amount'] ?? '', $r['rent_collected']['amount'], $r['expenses_unrecovered']['amount'],
                $r['financing']['interest']['amount'], $r['financing']['insurance']['amount'], $r['financing']['fees']['amount'],
                $r['gross_bp'] ?? '', $r['net_bp'] ?? '', $r['net_after_financing_bp'] ?? '', (string) ($r['reason'] ?? ''), $devise,
            ];
        }

        return $lignes;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function unitReferences(array $ids): array
    {
        $references = [];

        foreach ($this->lots->findMany($ids) as $id => $lot) {
            $references[$id] = $lot->reference;
        }

        return $references;
    }
}
