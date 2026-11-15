<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use Illuminate\Support\Facades\DB;

final class ReferenceSequence
{
    public static function next(): string
    {
        $annee = (int) now()->format('Y');

        DB::table('support_reference_counters')->insertOrIgnore(['year' => $annee, 'last_value' => 0]);
        $valeur = (int) DB::table('support_reference_counters')->where('year', $annee)->lockForUpdate()->value('last_value') + 1;
        DB::table('support_reference_counters')->where('year', $annee)->update(['last_value' => $valeur]);

        return sprintf('SUP-%d-%05d', $annee, $valeur);
    }
}
