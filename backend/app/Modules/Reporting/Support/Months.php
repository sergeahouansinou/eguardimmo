<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use Carbon\CarbonImmutable;

final class Months
{
    /**
     * @return array{string, CarbonImmutable, CarbonImmutable} mois `Y-m`, premier et dernier jour
     */
    public static function bounds(?string $mois, CarbonImmutable $today): array
    {
        $debut = $mois === null ? $today->startOfMonth() : CarbonImmutable::createFromFormat('!Y-m', $mois) ?? $today->startOfMonth();

        return [$debut->format('Y-m'), $debut, $debut->endOfMonth()->startOfDay()];
    }
}
