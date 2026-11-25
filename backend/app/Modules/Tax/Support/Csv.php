<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Shared\Csv\CsvField;

final class Csv
{
    /**
     * UTF-8, `;`, texte entre guillemets avec préfixe anti-formule ; les entiers (montants en unités mineures) restent bruts.
     *
     * @param  list<list<string|int>>  $lignes
     */
    public static function render(array $lignes): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $l): string => implode(';', array_map(CsvField::render(...), $l)), $lignes))."\r\n";
    }
}
