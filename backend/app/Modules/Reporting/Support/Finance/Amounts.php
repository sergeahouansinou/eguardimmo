<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use Money\Money;

/**
 * Montants en unités mineures entières, formes de réponse et rendements en points de base (arrondi au demi supérieur, entiers seulement).
 */
final class Amounts
{
    public const int BASIS_POINTS = 10000;

    /**
     * @return array{amount: int, currency: string}
     */
    public static function view(int $minor, string $currency): array
    {
        return ['amount' => $minor, 'currency' => $currency];
    }

    public static function minor(Money $montant): int
    {
        return (int) $montant->getAmount();
    }

    /**
     * Quotient arrondi au demi supérieur (vers +l'infini), diviseur strictement positif.
     */
    public static function divide(int $numerator, int $denominator): int
    {
        $majore = 2 * $numerator + $denominator;
        $quotient = intdiv($majore, 2 * $denominator);

        return $majore % (2 * $denominator) < 0 ? $quotient - 1 : $quotient;
    }

    public static function basisPoints(int $numerator, int $cost): int
    {
        return self::divide($numerator * self::BASIS_POINTS, $cost);
    }
}
