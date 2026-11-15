<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use Illuminate\Support\Facades\DB;

final class EntryNumbering
{
    /**
     * Continu par organisation et par exercice ; à appeler dans la transaction qui écrit l'écriture, pour que l'annulation libère le numéro.
     */
    public function next(string $organizationId, int $fiscalYear): int
    {
        $cle = ['organization_id' => $organizationId, 'fiscal_year' => $fiscalYear];

        DB::table('journal_entry_counters')->insertOrIgnore([...$cle, 'last_value' => 0]);
        $valeur = (int) DB::table('journal_entry_counters')->where($cle)->lockForUpdate()->value('last_value') + 1;
        DB::table('journal_entry_counters')->where($cle)->update(['last_value' => $valeur]);

        return $valeur;
    }
}
