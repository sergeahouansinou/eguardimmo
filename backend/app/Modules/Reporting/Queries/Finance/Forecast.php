<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Finance;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Data\ForecastAssumptionsData;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\AssumptionsStore;
use App\Modules\Reporting\Support\Finance\AssumptionsView;
use App\Modules\Reporting\Support\Finance\ExpenseRecords;
use App\Modules\Reporting\Support\Finance\ForecastIncome;
use Carbon\CarbonImmutable;

/**
 * Projection de trésorerie sur 12 mois à partir du mois courant : une projection, pas un solde, et rien n'est stocké. Entrées : lignes des baux
 * en cours (`ForecastIncome`). Sorties : moyenne mensuelle des douze derniers mois par catégorie, majorée de l'hypothèse de hausse (hors
 * intérêts de prêt, portés par l'échéancier), échéances de prêts, dépenses ponctuelles saisies. Ouverture : banque à la fin du mois précédent.
 */
final readonly class Forecast
{
    public const int MONTHS = 12;

    public function __construct(
        private ForecastIncome $revenus,
        private ExpenseRecords $depenses,
        private LoanCosts $prets,
        private LedgerReader $livre,
        private OrganizationDirectory $organisations,
        private AssumptionsStore $hypotheses,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function of(CarbonImmutable $today): array
    {
        $devise = $this->organisations->currency();
        $code = $devise->getCode();
        $debut = $today->startOfMonth();
        $fin = $debut->addMonthsNoOverflow(self::MONTHS);
        $hypotheses = $this->hypotheses->current();
        $recettes = $this->revenus->between($debut, $fin, $code, $hypotheses);
        $categories = $this->monthlyCategories($debut, $hypotheses);
        $depensesMensuelles = array_sum(array_column($categories, 'amount'));
        $echeances = [];
        $ponctuelles = [];

        foreach ($this->prets->installments($debut, $fin) as $e) {
            $m = substr($e->dueOn, 0, 7);
            $echeances[$m] = ($echeances[$m] ?? 0) + Amounts::minor($e->payment) + Amounts::minor($e->insurance);
        }

        foreach ($hypotheses->oneOffExpenses as $d) {
            $ponctuelles[$d['month']] = ($ponctuelles[$d['month']] ?? 0) + $d['amount'];
        }

        $ouverture = Amounts::minor($this->livre->accountBalance(AccountRole::Bank, $devise, $debut->subDay()));
        $solde = $ouverture;
        $mois = [];

        foreach ($recettes['months'] as $m => $r) {
            $entrees = $r['rent'] + $r['charges'];
            $sorties = $depensesMensuelles + ($echeances[$m] ?? 0) + ($ponctuelles[$m] ?? 0);
            $solde += $entrees - $sorties;
            $mois[] = [
                'month' => $m,
                'inflows' => ['rent' => Amounts::view($r['rent'], $code), 'charges' => Amounts::view($r['charges'], $code), 'total' => Amounts::view($entrees, $code)],
                'outflows' => [
                    'expenses' => Amounts::view($depensesMensuelles, $code),
                    'loans' => Amounts::view($echeances[$m] ?? 0, $code),
                    'one_off' => Amounts::view($ponctuelles[$m] ?? 0, $code),
                    'total' => Amounts::view($sorties, $code),
                ],
                'net' => Amounts::view($entrees - $sorties, $code),
                'closing' => Amounts::view($solde, $code),
            ];
        }

        return [
            'kind' => 'projection',
            'notice' => 'Projection, ce n\'est pas un solde',
            'from' => $debut->toDateString(),
            'to' => $fin->subDay()->toDateString(),
            'currency' => $code,
            'opening' => ['as_of' => $debut->subDay()->toDateString(), 'amount' => Amounts::view($ouverture, $code)],
            'months' => $mois,
            'expense_categories' => array_map(fn (array $c): array => ['category' => $c['category'], 'monthly' => Amounts::view($c['amount'], $code)], $categories),
            'assumptions' => AssumptionsView::of($hypotheses, $code),
            'warnings' => $recettes['foreign_currency_leases'] === 0 ? [] : [['code' => 'foreign_currency_leases_ignored', 'count' => $recettes['foreign_currency_leases']]],
        ];
    }

    /**
     * @return list<array{category: string, amount: int}>
     */
    private function monthlyCategories(CarbonImmutable $debut, ForecastAssumptionsData $hypotheses): array
    {
        $totaux = [];

        foreach ($this->depenses->between($debut->subMonthsNoOverflow(self::MONTHS), $debut, $this->organisations->currency()) as $e) {
            if ($e->semantic !== ExpenseCategorySemantic::LoanInterest->value) {
                $totaux[$e->semantic] = ($totaux[$e->semantic] ?? 0) + $e->amount;
            }
        }

        ksort($totaux);
        $categories = [];

        foreach ($totaux as $categorie => $total) {
            $moyenne = Amounts::divide($total, self::MONTHS);
            $categories[] = ['category' => $categorie, 'amount' => Amounts::divide($moyenne * (ForecastAssumptionsData::PERCENT_SCALE + $hypotheses->growthMilli), ForecastAssumptionsData::PERCENT_SCALE)];
        }

        return $categories;
    }
}
