<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Money\Currency;
use Money\Money;

/**
 * Solde du compte locataire (reste dû, avances déduites) de plusieurs baux en une requête.
 */
final class LeaseDues
{
    /**
     * @param  list<string>  $leaseIds
     * @return array<string, Money> par bail ; un bail sans écriture vaut zéro
     */
    public function of(array $leaseIds, Currency $currency, ?CarbonImmutable $asOf): array
    {
        $soldes = [];

        foreach ($leaseIds as $id) {
            $soldes[$id] = new Money(0, $currency);
        }

        foreach (array_chunk(array_values(array_unique($leaseIds)), 500) as $lot) {
            $requete = JournalLine::query()
                ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
                ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
                ->where('a.role', AccountRole::TenantReceivable->value)
                ->where('journal_lines.currency', $currency->getCode())
                ->whereIn('journal_lines.lease_id', $lot);

            if ($asOf !== null) {
                $requete->where('e.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
            }

            foreach ($requete->selectRaw('journal_lines.lease_id as lease_id, coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')->groupBy('journal_lines.lease_id')->toBase()->get() as $ligne) {
                $soldes[(string) $ligne->lease_id] = MoneyColumns::money($ligne->debit, $currency)->subtract(MoneyColumns::money($ligne->credit, $currency));
            }
        }

        return $soldes;
    }
}
