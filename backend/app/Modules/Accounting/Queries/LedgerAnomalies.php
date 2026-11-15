<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\LedgerAnomalyData;
use App\Modules\Accounting\Enums\AnomalyKind;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Lecture de toutes les organisations en SQL : contrôle de plateforme, sans contexte d'organisation.
 */
final class LedgerAnomalies
{
    /**
     * @return list<LedgerAnomalyData>
     */
    public function find(): array
    {
        $anomalies = [];

        $desequilibrees = DB::table('journal_lines')
            ->select('organization_id', 'journal_entry_id', 'currency')
            ->selectRaw('sum(debit) as total_debit, sum(credit) as total_credit')
            ->groupBy('organization_id', 'journal_entry_id', 'currency')
            ->havingRaw('sum(debit) <> sum(credit)')
            ->get();

        foreach ($desequilibrees as $ligne) {
            $anomalies[] = new LedgerAnomalyData(AnomalyKind::Unbalanced, (string) $ligne->organization_id, (string) $ligne->journal_entry_id,
                "Devise {$ligne->currency} : débits {$ligne->total_debit}, crédits {$ligne->total_credit}.");
        }

        $incompletes = DB::table('journal_entries as e')
            ->leftJoin('journal_lines as l', 'l.journal_entry_id', '=', 'e.id')
            ->select('e.organization_id', 'e.id')
            ->selectRaw('count(l.id) as lignes')
            ->groupBy('e.organization_id', 'e.id')
            ->havingRaw('count(l.id) < 2')
            ->get();

        foreach ($incompletes as $entree) {
            $anomalies[] = new LedgerAnomalyData(AnomalyKind::TooFewLines, (string) $entree->organization_id, (string) $entree->id,
                "L'écriture compte {$entree->lignes} ligne(s).");
        }

        $invalides = DB::table('journal_lines')
            ->select('organization_id', 'journal_entry_id', 'id')
            ->where(fn (Builder $q): Builder => $q->where(fn (Builder $s): Builder => $s->where('debit', '>', 0)->where('credit', '>', 0))
                ->orWhere(fn (Builder $s): Builder => $s->where('debit', 0)->where('credit', 0)))
            ->get();

        foreach ($invalides as $ligne) {
            $anomalies[] = new LedgerAnomalyData(AnomalyKind::InvalidLine, (string) $ligne->organization_id, (string) $ligne->journal_entry_id,
                "La ligne {$ligne->id} n'est ni un débit ni un crédit.");
        }

        $trous = DB::table('journal_entries')
            ->select('organization_id', 'fiscal_year')
            ->selectRaw('count(*) as total, max(number) as dernier, min(number) as premier')
            ->groupBy('organization_id', 'fiscal_year')
            ->havingRaw('count(*) <> max(number) or min(number) <> 1')
            ->get();

        foreach ($trous as $exercice) {
            $anomalies[] = new LedgerAnomalyData(AnomalyKind::NumberingGap, (string) $exercice->organization_id, null,
                "Exercice {$exercice->fiscal_year} : {$exercice->total} écritures, numéros de {$exercice->premier} à {$exercice->dernier}.");
        }

        return $anomalies;
    }
}
