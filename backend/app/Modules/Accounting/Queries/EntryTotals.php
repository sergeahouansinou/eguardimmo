<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Models\JournalLine;

final class EntryTotals
{
    private const int LOT = 500;

    /**
     * @param  list<string>  $entryIds
     * @return array<string, int> total des débits en unités mineures, par écriture ; une écriture inconnue est absente
     */
    public function debits(array $entryIds): array
    {
        $totaux = [];

        foreach (array_chunk($entryIds, self::LOT) as $lot) {
            $lignes = JournalLine::query()->whereIn('journal_entry_id', $lot)->selectRaw('journal_entry_id, SUM(debit) as total')->groupBy('journal_entry_id')->get();

            foreach ($lignes as $ligne) {
                $totaux[(string) $ligne->getAttribute('journal_entry_id')] = (int) $ligne->getAttribute('total');
            }
        }

        return $totaux;
    }
}
