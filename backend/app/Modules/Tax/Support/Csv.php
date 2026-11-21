<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

final class Csv
{
    /**
     * UTF-8, `;`, texte entre guillemets avec préfixe anti-formule ; les entiers (montants en unités mineures) restent bruts.
     *
     * @param  list<list<string|int>>  $lignes
     */
    public static function render(array $lignes): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $l): string => implode(';', array_map(self::champ(...), $l)), $lignes))."\r\n";
    }

    private static function champ(string|int $valeur): string
    {
        if (is_int($valeur)) {
            return (string) $valeur;
        }

        $texte = $valeur;

        if ($texte !== '' && str_contains("=+-@\t\r", $texte[0])) {
            $texte = "'".$texte;
        }

        return '"'.str_replace('"', '""', str_replace(["\r", "\n"], ' ', $texte)).'"';
    }
}
