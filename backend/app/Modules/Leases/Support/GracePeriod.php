<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Le locataire garde l'accès aux données de son bail 12 mois après son dernier jour d'occupation (ADR 0024).
 * Les deux formulations se valent : `until($dernierJour) >= aujourd'hui` et `dernierJour >= cutoff(aujourd'hui)`.
 */
final class GracePeriod
{
    public const int MONTHS = 12;

    /**
     * Jour d'occupation le plus ancien dont l'accès court encore ; une fin de période exclue se compare avec `>`.
     */
    public static function cutoff(CarbonInterface $today): string
    {
        return CarbonImmutable::parse($today->toDateString())->subMonths(self::MONTHS)->toDateString();
    }

    /**
     * Dernier jour d'accès, compris, pour un dernier jour d'occupation (fin de période exclue moins un jour).
     */
    public static function until(string $lastDay): string
    {
        return CarbonImmutable::parse($lastDay)->addMonthsNoOverflow(self::MONTHS)->toDateString();
    }
}
