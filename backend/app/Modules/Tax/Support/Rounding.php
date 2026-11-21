<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

/**
 * Arrondi au demi supérieur en arithmétique entière : un float arrondirait mal les montants limites.
 */
final class Rounding
{
    public const int BASIS_POINTS = 10000;

    /**
     * Quotient arrondi au plus proche, 0,5 vers le haut (vers +∞ pour un négatif) ; le diviseur est strictement positif.
     */
    public static function divide(int $dividende, int $diviseur): int
    {
        $x = $dividende * 2 + $diviseur;
        $q = intdiv($x, $diviseur * 2);

        return $x % ($diviseur * 2) < 0 ? $q - 1 : $q;
    }

    /**
     * Arrondit des unités mineures à l'unité majeure la plus proche, et les rend en unités mineures.
     */
    public static function toMajor(int $minor, int $minorPerMajor): int
    {
        return self::divide($minor, $minorPerMajor) * $minorPerMajor;
    }
}
