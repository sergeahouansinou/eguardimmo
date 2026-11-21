<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\MovementData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Money\Currency;

/**
 * Totaux du grand livre par compte, partie, lot, mois et type de source : une seule requête agrégée, dates en
 * intervalle semi-ouvert.
 */
final class Movements
{
    private const string SOURCE = 'coalesce(o.source_type, e.source_type)';

    /**
     * @param  list<AccountRole>  $roles
     * @param  list<string>|null  $partyIds
     * @param  list<string>|null  $unitIds
     * @param  list<SourceType>|null  $sources
     * @return list<MovementData>
     */
    public function between(array $roles, Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $partyIds, ?array $unitIds, ?array $sources): array
    {
        if ($roles === [] || $partyIds === [] || $unitIds === [] || $sources === []) {
            return [];
        }

        $requete = $this->lignes($currency)
            ->whereIn('a.role', array_map(fn (AccountRole $r): string => $r->value, $roles))
            ->where('e.entry_date', '>=', $from->format('Y-m-d'))
            ->where('e.entry_date', '<', $to->addDay()->format('Y-m-d'));

        if ($partyIds !== null) {
            $requete->whereIn('journal_lines.party_id', $partyIds);
        }

        if ($unitIds !== null) {
            $requete->whereIn('journal_lines.unit_id', $unitIds);
        }

        if ($sources !== null) {
            $requete->whereRaw(self::SOURCE.' in ('.implode(', ', array_fill(0, count($sources), '?')).')', array_map(fn (SourceType $s): string => $s->value, $sources));
        }

        $lues = $requete
            ->selectRaw('journal_lines.party_id as party_id, journal_lines.unit_id as unit_id, substr(e.entry_date, 1, 7) as month, a.role as role, '.self::SOURCE.' as source, sum(journal_lines.debit) as debit, sum(journal_lines.credit) as credit')
            ->groupBy('journal_lines.party_id', 'journal_lines.unit_id', 'a.role')
            ->groupByRaw('substr(e.entry_date, 1, 7), '.self::SOURCE)
            ->orderBy('month')->orderBy('role')->orderBy('source')
            ->toBase()->get();

        $mouvements = [];

        foreach ($lues as $ligne) {
            $mouvements[] = new MovementData(
                is_string($ligne->party_id) ? $ligne->party_id : null,
                is_string($ligne->unit_id) ? $ligne->unit_id : null,
                (string) $ligne->month,
                AccountRole::from((string) $ligne->role),
                SourceType::from((string) $ligne->source),
                MoneyColumns::money($ligne->debit, $currency),
                MoneyColumns::money($ligne->credit, $currency),
            );
        }

        return $mouvements;
    }

    /**
     * @return Builder<JournalLine>
     */
    private function lignes(Currency $currency): Builder
    {
        return JournalLine::query()
            ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
            ->leftJoin('journal_entries as o', fn (JoinClause $j) => $j->on('o.id', '=', 'e.reversal_of_id')->on('o.organization_id', '=', 'e.organization_id'))
            ->where('journal_lines.currency', $currency->getCode());
    }
}
