<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Shared\Csv\CsvField;

final class Csv
{
    /**
     * @param  list<list<string|int>>  $lignes
     */
    public static function render(array $lignes): string
    {
        return "\u{FEFF}".implode("\r\n", array_map(fn (array $l): string => implode(';', array_map(CsvField::render(...), $l)), $lignes))."\r\n";
    }
}
