<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\BankStatementLine;
use Illuminate\Support\Facades\DB;

/**
 * Verrouille des lignes de relevé en tête de transaction (ordre des verrous, ADR 0007) : relevés d'abord (verrou partagé, lu à
 * jour même sous REPEATABLE READ), puis lignes d'identifiant croissant, comme `VoidStatement` ; jamais l'ordre de la requête,
 * pour qu'aucune paire de requêtes ne s'attende mutuellement.
 */
final class LineLocker
{
    /**
     * @param  list<string>  $ids
     * @return array<string, BankStatementLine> par identifiant
     */
    public function lock(string $accountId, array $ids): array
    {
        $ids = array_values(array_unique($ids));
        sort($ids);

        $releves = DB::table('bank_statement_lines')->where('bank_account_id', $accountId)->whereIn('id', $ids)->distinct()->pluck('statement_id')->sort()->values()->all();
        $annules = DB::table('bank_statements')->whereIn('id', $releves)->orderBy('id')->sharedLock()->get(['id', 'voided_at'])->contains(fn (object $r): bool => $r->voided_at !== null);

        $lignes = BankStatementLine::query()->where('bank_account_id', $accountId)->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

        if ($lignes->count() !== count($ids)) {
            throw ErrorCode::LineNotFound->problem();
        }

        if ($annules) {
            throw ErrorCode::LineNotMatchable->problem();
        }

        return $lignes->all();
    }
}
