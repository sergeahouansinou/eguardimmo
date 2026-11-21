<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

final class ActivityCsv
{
    /**
     * Séparateur `;`, UTF-8. Une cellule qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est préfixée d'une apostrophe :
     * un tableur ne l'interprète pas comme une formule.
     *
     * @param  list<string|null>  $cellules
     */
    public static function line(array $cellules): string
    {
        return implode(';', array_map(self::cell(...), $cellules))."\r\n";
    }

    private static function cell(?string $valeur): string
    {
        $texte = (string) $valeur;

        if ($texte !== '' && str_contains("=+-@\t\r", $texte[0])) {
            $texte = "'".$texte;
        }

        $texte = str_replace(["\r", "\n"], ' ', $texte);

        return '"'.str_replace('"', '""', $texte).'"';
    }
}
