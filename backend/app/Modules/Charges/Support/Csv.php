<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Shared\Csv\CsvField;

final class Csv
{
    /**
     * UTF-8 avec BOM, séparateur `;` ; une cellule de texte qui commence par `= + - @` ou une tabulation est préfixée d'une apostrophe (anti-formule, ADR 0031).
     *
     * @param  list<list<string|int>>  $lignes
     */
    public static function render(array $lignes): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $l): string => implode(';', array_map(CsvField::render(...), $l)), $lignes))."\r\n";
    }
}
