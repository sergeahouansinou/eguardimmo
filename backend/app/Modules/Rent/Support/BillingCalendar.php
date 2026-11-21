<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\Periodicity;
use Carbon\CarbonImmutable;

/**
 * Périodes en mois civils, ancrées sur le premier jour de la première période appelée (`billing_from`).
 */
final class BillingCalendar
{
    public const int NOTICE_LEAD_DAYS = 10;

    public static function months(Periodicity $periodicite): int
    {
        return match ($periodicite) {
            Periodicity::Monthly => 1,
            Periodicity::Quarterly => 3,
            Periodicity::Semiannual => 6,
            Periodicity::Annual => 12,
        };
    }

    public static function firstOfMonth(CarbonImmutable $date): CarbonImmutable
    {
        return $date->startOfMonth()->startOfDay();
    }

    public static function periodStart(CarbonImmutable $ancre, int $rang, int $mois): CarbonImmutable
    {
        return $ancre->addMonthsNoOverflow($rang * $mois);
    }

    /**
     * Premier jour de la période suivante.
     */
    public static function periodEndExclusive(CarbonImmutable $debut, int $mois): CarbonImmutable
    {
        return $debut->addMonthsNoOverflow($mois);
    }

    /**
     * À échoir : le jour d'échéance du premier mois de la période. Échu : le jour d'échéance du mois qui suit la période.
     */
    public static function dueDate(BillingTiming $terme, CarbonImmutable $debut, int $mois, int $jour): CarbonImmutable
    {
        $referenceMois = $terme === BillingTiming::Advance ? $debut : $debut->addMonthsNoOverflow($mois);

        return $referenceMois->startOfMonth()->setDay($jour)->startOfDay();
    }

    /**
     * Date à partir de laquelle l'échéance est générée et son avis émissible.
     */
    public static function noticeDate(CarbonImmutable $echeance): CarbonImmutable
    {
        return $echeance->subDays(self::NOTICE_LEAD_DAYS);
    }

    public static function days(CarbonImmutable $debut, CarbonImmutable $finExclue): int
    {
        return (int) round($debut->startOfDay()->diffInDays($finExclue->startOfDay(), true));
    }
}
