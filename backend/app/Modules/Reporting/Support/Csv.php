<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

final class Csv
{
    /**
     * @param  list<list<string|int>>  $lignes
     */
    public static function render(array $lignes): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $l): string => implode(';', array_map(self::champ(...), $l)), $lignes))."\r\n";
    }

    private static function champ(string|int $valeur): string
    {
        $texte = (string) $valeur;

        if (is_int($valeur)) {
            return $texte;
        }

        if ($texte !== '' && str_contains("=+-@\t\r", $texte[0])) {
            $texte = "'".$texte;
        }

        return '"'.str_replace('"', '""', str_replace(["\r", "\n"], ' ', $texte)).'"';
    }
}
