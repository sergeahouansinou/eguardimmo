<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Shared\Csv\CsvField;

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
        return implode(';', array_map(CsvField::render(...), $cellules))."\r\n";
    }
}
