<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\AgingBucketData;
use App\Modules\Accounting\Data\AgingData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;
use Money\Currency;
use Money\Money;

/**
 * Reste dû des créances ouvertes par tranche d'ancienneté, en une requête : le solde de chaque créance (pièce portée par
 * `item_id`) est calculé en sous-requête, puis regroupé par date comptable de la créance.
 */
final class Aging
{
    private const array TRANCHES = ['0_30' => 30, '31_60' => 60, '61_90' => 90, 'over_90' => PHP_INT_MAX];

    public function at(Currency $currency, CarbonImmutable $asOf): AgingData
    {
        $creances = JournalLine::query()
            ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
            ->whereIn('a.role', [AccountRole::TenantReceivable->value, AccountRole::CustomerReceivable->value])
            ->whereNotNull('journal_lines.item_id')
            ->where('journal_lines.currency', $currency->getCode())
            ->where('e.entry_date', '<', $asOf->addDay()->format('Y-m-d'))
            ->groupBy('journal_lines.item_id')
            ->havingRaw('sum(journal_lines.debit) - sum(journal_lines.credit) > 0')
            ->selectRaw('journal_lines.item_id as item_id, min(e.entry_date) as called_on, sum(journal_lines.debit) - sum(journal_lines.credit) as due')
            ->toBase();

        $lues = DB::query()->fromSub($creances, 'creances')
            ->selectRaw('called_on, sum(due) as due, count(*) as n')
            ->groupBy('called_on')
            ->get();

        $zero = new Money(0, $currency);
        $montants = array_fill_keys(array_keys(self::TRANCHES), $zero);
        $nombres = array_fill_keys(array_keys(self::TRANCHES), 0);

        foreach ($lues as $ligne) {
            $age = (int) CarbonImmutable::parse(substr((string) $ligne->called_on, 0, 10))->diffInDays($asOf->startOfDay());
            $cle = $this->tranche($age);
            $montants[$cle] = $montants[$cle]->add(MoneyColumns::money($ligne->due, $currency));
            $nombres[$cle] += (int) $ligne->n;
        }

        $tranches = [];

        foreach (array_keys(self::TRANCHES) as $cle) {
            $tranches[] = new AgingBucketData($cle, $montants[$cle], $nombres[$cle]);
        }

        return new AgingData($tranches, $zero->add(...array_values($montants)), array_sum($nombres));
    }

    private function tranche(int $age): string
    {
        foreach (self::TRANCHES as $cle => $limite) {
            if ($age <= $limite) {
                return $cle;
            }
        }

        return 'over_90';
    }
}
