<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Support;

use Carbon\CarbonImmutable;
use InvalidArgumentException;

/**
 * « Aujourd'hui » se lit dans le fuseau des logements : une arrivée du jour ne dépend pas de l'heure UTC du serveur.
 */
final class Calendar
{
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone())->startOfDay();
    }

    public static function date(string $jour): CarbonImmutable
    {
        return (CarbonImmutable::createFromFormat('Y-m-d', $jour, self::timezone()) ?? throw new InvalidArgumentException("Date invalide [{$jour}]."))->startOfDay();
    }

    /**
     * Nombre de jours entiers entre aujourd'hui et la date donnée (négatif si elle est passée).
     */
    public static function daysUntil(string $jour): int
    {
        return (int) self::today()->diffInDays(self::date($jour), false);
    }

    private static function timezone(): string
    {
        return is_string($fuseau = config('marketplace.timezone')) ? $fuseau : 'Europe/Paris';
    }
}
