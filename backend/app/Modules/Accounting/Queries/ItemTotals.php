<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Money\Currency;
use Money\Money;

/**
 * Montant net débiteur par pièce (écritures et contrepassations confondues) : la catégorie d'une dépense se lit dans
 * son module, le montant ici.
 */
final class ItemTotals
{
    /**
     * @param  list<string>|null  $unitIds
     * @return array<string, Money> par identifiant de pièce ; une pièce sans ligne dans l'intervalle est absente
     */
    public function between(ItemType $type, Currency $currency, CarbonImmutable $from, CarbonImmutable $to, ?array $unitIds): array
    {
        if ($unitIds === []) {
            return [];
        }

        $requete = JournalLine::query()
            ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->where('journal_lines.item_type', $type->value)
            ->where('journal_lines.currency', $currency->getCode())
            ->where('e.entry_date', '>=', $from->format('Y-m-d'))
            ->where('e.entry_date', '<', $to->addDay()->format('Y-m-d'));

        if ($unitIds !== null) {
            $requete->whereIn('journal_lines.unit_id', $unitIds);
        }

        $totaux = [];

        foreach ($requete->selectRaw('journal_lines.item_id as item_id, sum(journal_lines.debit) as debit, sum(journal_lines.credit) as credit')->groupBy('journal_lines.item_id')->toBase()->get() as $ligne) {
            $totaux[(string) $ligne->item_id] = MoneyColumns::money($ligne->debit, $currency)->subtract(MoneyColumns::money($ligne->credit, $currency));
        }

        return $totaux;
    }
}
