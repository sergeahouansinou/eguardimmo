<?php

declare(strict_types=1);

namespace App\Modules\Banking\Queries;

use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\BankSuggestion;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Lignes de relevé des imports vivants (jamais celles d'un import annulé), avec leur meilleure proposition et leur pointage vivant :
 * deux requêtes de plus quelle que soit la taille de la page.
 */
final class BankLines
{
    /**
     * @param  array<string, mixed>  $filtres
     * @return Builder<BankStatementLine>
     */
    public function query(array $filtres): Builder
    {
        $requete = BankStatementLine::query()
            ->whereIn('statement_id', DB::table('bank_statements')->whereNull('voided_at')->select('id'))
            ->orderByDesc('booking_date')->orderByDesc('id');

        foreach (['account_id' => 'bank_account_id', 'statement_id' => 'statement_id', 'state' => 'state', 'direction' => 'direction'] as $filtre => $colonne) {
            if (isset($filtres[$filtre])) {
                $requete->where($colonne, (string) $filtres[$filtre]);
            }
        }

        if (isset($filtres['from'])) {
            $requete->whereDate('booking_date', '>=', (string) $filtres['from']);
        }

        if (isset($filtres['to'])) {
            $requete->whereDate('booking_date', '<=', (string) $filtres['to']);
        }

        if (isset($filtres['amount'])) {
            $requete->where('amount', (int) $filtres['amount']);
        }

        return $requete;
    }

    /**
     * @param  CursorPaginator<int, BankStatementLine>  $page
     * @return CursorPaginator<int, BankStatementLine>
     */
    public function decorate(CursorPaginator $page): CursorPaginator
    {
        $this->decorateMany($page->items());

        return $page;
    }

    /**
     * @param  iterable<BankStatementLine>  $lignes
     */
    public function decorateMany(iterable $lignes): void
    {
        $ids = [];

        foreach ($lignes as $ligne) {
            $ids[] = $ligne->id;
        }

        if ($ids === []) {
            return;
        }

        $propositions = BankSuggestion::query()->whereIn('statement_line_id', $ids)->orderByDesc('score')->orderBy('id')->get()->unique('statement_line_id')->keyBy('statement_line_id');
        $pointages = BankMatchItem::query()->where('side', MatchSide::StatementLine)->whereNull('undone_at')->whereIn('ref_id', $ids)->pluck('match_id', 'ref_id');

        foreach ($lignes as $ligne) {
            $ligne->setAttribute('best_suggestion', $propositions->get($ligne->id));
            $ligne->setAttribute('active_match_id', $pointages->get($ligne->id));
        }
    }
}
