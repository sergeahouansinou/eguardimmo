<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use Illuminate\Pagination\Cursor;

final class DateCursor
{
    /**
     * Le paginateur écrit la date de tri avec l'heure (« 2026-02-01 00:00:00 ») ; une colonne `date` se compare au jour seul.
     */
    public static function decode(?string $encode, string $colonne): ?Cursor
    {
        $curseur = $encode === null ? null : Cursor::fromEncoded($encode);

        if ($curseur === null) {
            return null;
        }

        $parametres = $curseur->toArray();
        unset($parametres['_pointsToNextItems']);
        $parametres[$colonne] = substr((string) ($parametres[$colonne] ?? ''), 0, 10);

        return new Cursor($parametres, $curseur->pointsToNextItems());
    }
}
