<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use Money\Currencies\ISOCurrencies;
use Money\Currency;

/**
 * Montant décimal textuel vers unités mineures, sans float. Rend null pour toute forme douteuse.
 */
final class AmountParser
{
    public const int MAX_MINOR = 100_000_000_000_000;

    public static function minorUnits(string $texte, string $currency, string $decimal = '.', ?string $thousands = null): ?int
    {
        if ($currency === '') {
            return null;
        }

        $iso = new ISOCurrencies;
        $devise = new Currency($currency);

        if (! $iso->contains($devise)) {
            return null;
        }

        $decimales = $iso->subunitFor($devise);
        $valeur = str_replace(["\u{00A0}", "\u{202F}", ' '], '', trim($texte));

        if ($thousands !== null && $thousands !== '' && $thousands !== ' ') {
            $valeur = str_replace($thousands, '', $valeur);
        }

        if ($decimal !== '.') {
            if (str_contains($valeur, '.')) {
                return null;
            }
            $valeur = str_replace($decimal, '.', $valeur);
        }

        if (preg_match('/^([+-]?)(\d+)(?:\.(\d+))?$/D', $valeur, $m) !== 1) {
            return null;
        }

        $fraction = $m[3] ?? '';

        if (strlen($fraction) > $decimales) {
            return null;
        }

        $chiffres = ltrim($m[2].str_pad($fraction, $decimales, '0'), '0');

        if ($chiffres === '') {
            return 0;
        }

        if (strlen($chiffres) > 18) {
            return null;
        }

        $entier = (int) $chiffres;

        if ($entier > self::MAX_MINOR) {
            return null;
        }

        return $m[1] === '-' ? -$entier : $entier;
    }
}
