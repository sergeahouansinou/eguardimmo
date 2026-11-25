<?php

declare(strict_types=1);

namespace App\Shared\Csv;

final class CsvField
{
    private const DEBUTS_DE_FORMULE = "=+-@\t\r";

    /**
     * Cellule texte entre guillemets, neutralisée contre l'injection de formule : les retours à la ligne deviennent des espaces d'abord,
     * puis les blancs de tête tombent, sinon un `\n=1+1` ressortirait ` =1+1` que le tableur évalue. Un entier reste brut : un montant négatif est un nombre.
     */
    public static function render(string|int|null $valeur): string
    {
        if (is_int($valeur)) {
            return (string) $valeur;
        }

        $texte = ltrim(str_replace(["\r\n", "\r", "\n"], ' ', (string) $valeur));

        if ($texte !== '' && str_contains(self::DEBUTS_DE_FORMULE, $texte[0])) {
            $texte = "'".$texte;
        }

        return '"'.str_replace('"', '""', $texte).'"';
    }
}
