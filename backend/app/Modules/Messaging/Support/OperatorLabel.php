<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

/**
 * Un opérateur n'apparaît à l'organisation que par son prénom et l'initiale de son nom (minimisation).
 */
final class OperatorLabel
{
    public static function of(string $nom): string
    {
        $morceaux = preg_split('/\s+/u', trim($nom), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($morceaux) < 2) {
            return $morceaux[0] ?? 'Support eGuardImmo';
        }

        return $morceaux[0].' '.mb_strtoupper(mb_substr($morceaux[count($morceaux) - 1], 0, 1)).'.';
    }
}
