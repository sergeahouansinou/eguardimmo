<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Finance;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Charges\PublicApi\DeclaredExpenses;
use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\Months;
use App\Modules\Reporting\Support\Finance\MonthTotals;
use Carbon\CarbonImmutable;

/**
 * Recettes et charges par mois et par lot : les écritures du grand livre (date comptable) et les dépenses déclarées. Le financement des
 * prêts (intérêts et assurance de l'échéancier) est une série à part, jamais additionnée aux dépenses.
 */
final readonly class RevenueExpenses
{
    private const array RECETTES = [AccountRole::RentRevenue->value => 'rent', AccountRole::ChargesRecovered->value => 'charges', AccountRole::FeeRevenue->value => 'fees', AccountRole::CollectionFees->value => 'fees'];

    private const array CHARGES = [AccountRole::Expenses, AccountRole::BankCharges];

    public function __construct(
        private LedgerAggregates $grandLivre,
        private DeclaredExpenses $declarees,
        private LoanCosts $prets,
        private OrganizationDirectory $organisations,
        private UnitDirectory $lots,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function between(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $devise = $this->organisations->currency();
        $code = $devise->getCode();
        $fin = $to->addDay();
        $mois = [];

        foreach (Months::between($from, $fin) as $m) {
            $mois[$m] = new MonthTotals;
        }

        $lots = [];
        $roles = [...array_map(AccountRole::from(...), array_keys(self::RECETTES)), ...self::CHARGES];

        foreach ($this->grandLivre->movements($roles, $devise, $from, $to) as $mouvement) {
            if (! isset($mois[$mouvement->month])) {
                continue;
            }

            $role = $mouvement->role->value;
            $net = Amounts::minor($mouvement->credit) - Amounts::minor($mouvement->debit);

            if (isset(self::RECETTES[$role])) {
                $this->addRevenue($mois[$mouvement->month], self::RECETTES[$role], $net);
                $lots[$mouvement->unitId ?? ''] = $this->cumul($lots[$mouvement->unitId ?? ''] ?? null, $net, 0);

                continue;
            }

            $mois[$mouvement->month]->ledger -= $net;
            $lots[$mouvement->unitId ?? ''] = $this->cumul($lots[$mouvement->unitId ?? ''] ?? null, 0, -$net);
        }

        foreach ($this->declarees->between($from, $fin) as $depense) {
            $montant = Amounts::minor($depense->amount);
            $mois[substr($depense->date, 0, 7)]->declared += $montant;
            $lots[$depense->unitId ?? ''] = $this->cumul($lots[$depense->unitId ?? ''] ?? null, 0, $montant);
        }

        foreach ($this->prets->installments($from, $fin) as $echeance) {
            $mois[substr($echeance->dueOn, 0, 7)]->interest += Amounts::minor($echeance->interest);
            $mois[substr($echeance->dueOn, 0, 7)]->insurance += Amounts::minor($echeance->insurance);
        }

        return $this->shape($from, $to, $code, $mois, $lots);
    }

    private function addRevenue(MonthTotals $total, string $genre, int $montant): void
    {
        match ($genre) {
            'rent' => $total->rent += $montant,
            'charges' => $total->charges += $montant,
            default => $total->fees += $montant,
        };
    }

    /**
     * @param  array{revenue: int, expenses: int}|null  $courant
     * @return array{revenue: int, expenses: int}
     */
    private function cumul(?array $courant, int $recette, int $charge): array
    {
        return ['revenue' => ($courant['revenue'] ?? 0) + $recette, 'expenses' => ($courant['expenses'] ?? 0) + $charge];
    }

    /**
     * @param  array<string, MonthTotals>  $mois
     * @param  array<string, array{revenue: int, expenses: int}>  $lots
     * @return array<string, mixed>
     */
    private function shape(CarbonImmutable $from, CarbonImmutable $to, string $code, array $mois, array $lots): array
    {
        $totaux = ['revenue' => 0, 'expenses' => 0, 'financing' => 0];
        $lignes = [];

        foreach ($mois as $m => $v) {
            $recette = $v->rent + $v->charges + $v->fees;
            $charge = $v->ledger + $v->declared;
            $financement = $v->interest + $v->insurance;
            $totaux['revenue'] += $recette;
            $totaux['expenses'] += $charge;
            $totaux['financing'] += $financement;
            $lignes[] = [
                'month' => $m,
                'revenue' => ['rent' => Amounts::view($v->rent, $code), 'charges' => Amounts::view($v->charges, $code), 'fees' => Amounts::view($v->fees, $code), 'total' => Amounts::view($recette, $code)],
                'expenses' => ['ledger' => Amounts::view($v->ledger, $code), 'declared' => Amounts::view($v->declared, $code), 'total' => Amounts::view($charge, $code)],
                'financing' => ['interest' => Amounts::view($v->interest, $code), 'insurance' => Amounts::view($v->insurance, $code), 'total' => Amounts::view($financement, $code)],
                'net_before_financing' => Amounts::view($recette - $charge, $code),
                'net_after_financing' => Amounts::view($recette - $charge - $financement, $code),
            ];
        }

        $reference = $this->units(array_values(array_filter(array_keys($lots), fn (string $id): bool => $id !== '')));
        ksort($lots);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'currency' => $code,
            'basis' => 'ledger',
            'months' => $lignes,
            'units' => array_map(fn (string $id, array $v): array => [
                'unit_id' => $id === '' ? null : $id,
                'unit_reference' => $reference[$id]['reference'] ?? null,
                'property_name' => $reference[$id]['property'] ?? null,
                'revenue' => Amounts::view($v['revenue'], $code),
                'expenses' => Amounts::view($v['expenses'], $code),
            ], array_keys($lots), $lots),
            'totals' => [
                'revenue' => Amounts::view($totaux['revenue'], $code),
                'expenses' => Amounts::view($totaux['expenses'], $code),
                'financing' => Amounts::view($totaux['financing'], $code),
                'net_before_financing' => Amounts::view($totaux['revenue'] - $totaux['expenses'], $code),
                'net_after_financing' => Amounts::view($totaux['revenue'] - $totaux['expenses'] - $totaux['financing'], $code),
            ],
        ];
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, array{reference: string, property: string}>
     */
    private function units(array $ids): array
    {
        $lus = [];

        foreach ($this->lots->findMany($ids) as $id => $lot) {
            $lus[$id] = ['reference' => $lot->reference, 'property' => $lot->propertyName];
        }

        return $lus;
    }
}
