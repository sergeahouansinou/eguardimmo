<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Planning\Enums\Recurrence;
use Carbon\CarbonImmutable;

/**
 * Développement d'une série en dates calendaires (sans heure ni fuseau). Le jour d'ancrage est celui de la première occurrence :
 * un 31 ou un 29 février est ramené au dernier jour du mois, sans dérive d'un mois sur l'autre. `until` est inclus.
 */
final class Occurrences
{
    /**
     * Première occurrence au plus tôt à `$from`, nulle si la série est finie avant.
     */
    public static function firstOnOrAfter(CarbonImmutable $start, Recurrence $kind, ?CarbonImmutable $until, CarbonImmutable $from): ?CarbonImmutable
    {
        $candidate = match ($kind) {
            Recurrence::None => $start,
            Recurrence::Weekly => $start->addWeeks(max(0, intdiv(intdiv($from->getTimestamp() - $start->getTimestamp(), 86400) + 6, 7))),
            Recurrence::Monthly => self::byMonths($start, $from, 1),
            Recurrence::Yearly => self::byMonths($start, $from, 12),
        };

        if ($candidate->lessThan($from) || ($until !== null && $candidate->greaterThan($until))) {
            return null;
        }

        return $candidate;
    }

    /**
     * Occurrences dans [from, to), au plus `$max + 1` (le dépassement se détecte à `count > $max`).
     *
     * @return list<CarbonImmutable>
     */
    public static function between(CarbonImmutable $start, Recurrence $kind, ?CarbonImmutable $until, CarbonImmutable $from, CarbonImmutable $to, int $max): array
    {
        $dates = [];
        $curseur = $from;

        while (count($dates) <= $max && ($date = self::firstOnOrAfter($start, $kind, $until, $curseur)) !== null && $date->lessThan($to)) {
            $dates[] = $date;
            $curseur = $date->addDay();
        }

        return $dates;
    }

    private static function byMonths(CarbonImmutable $start, CarbonImmutable $from, int $step): CarbonImmutable
    {
        $ecart = ($from->year - $start->year) * 12 + ($from->month - $start->month);
        $mois = max(0, intdiv($ecart, $step) * $step);

        while (($candidate = self::inMonth($start, $mois))->lessThan($from)) {
            $mois += $step;
        }

        return $candidate;
    }

    private static function inMonth(CarbonImmutable $start, int $decalage): CarbonImmutable
    {
        $debut = $start->startOfMonth()->addMonthsNoOverflow($decalage);

        return $debut->setDay(min($start->day, $debut->daysInMonth));
    }
}
