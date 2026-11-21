<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Délais de réponse : un mois après la réception, trois en tout si la demande est prolongée ; un jour qui n'existe pas le mois suivant
 * retombe sur le dernier jour (31 janvier : 28 ou 29 février). L'échéance court jusqu'à la fin de la journée.
 */
final class Deadlines
{
    public static function dueAt(CarbonInterface $receivedAt): CarbonImmutable
    {
        return CarbonImmutable::instance($receivedAt)->addMonthNoOverflow()->endOfDay();
    }

    public static function extendedUntil(CarbonInterface $receivedAt): CarbonImmutable
    {
        return CarbonImmutable::instance($receivedAt)->addMonthsNoOverflow(3)->endOfDay();
    }
}
