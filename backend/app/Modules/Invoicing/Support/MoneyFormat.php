<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use Money\Currencies\ISOCurrencies;

final class MoneyFormat
{
    /**
     * Montant entier en unités mineures, présenté à la française sans passer par un flottant : « 1 234,50 € ».
     */
    public static function fr(int $montant, string $devise): string
    {
        $decimales = (new ISOCurrencies)->subunitFor(Currencies::of($devise));
        $absolu = abs($montant);
        $entier = $decimales === 0 ? $absolu : intdiv($absolu, 10 ** $decimales);
        $partie = $decimales === 0 ? '' : ','.str_pad((string) ($absolu % (10 ** $decimales)), $decimales, '0', STR_PAD_LEFT);
        $symbole = match ($devise) {
            'EUR' => '€',
            'CAD' => '$ CA',
            default => $devise,
        };

        return ($montant < 0 ? '-' : '').number_format($entier, 0, '', "\u{202F}").$partie."\u{00A0}".$symbole;
    }

    /**
     * Quantité en millièmes : « 1 », « 2,5 ».
     */
    public static function quantity(int $milli): string
    {
        $entier = intdiv($milli, 1000);
        $reste = $milli % 1000;

        return number_format($entier, 0, '', "\u{202F}").($reste === 0 ? '' : ','.rtrim(str_pad((string) $reste, 3, '0', STR_PAD_LEFT), '0'));
    }

    /**
     * Taux en cent-millièmes : « 20 % », « 5,5 % », « 9,975 % ».
     */
    public static function rate(int $pcm): string
    {
        $entier = intdiv($pcm, 1000);
        $reste = $pcm % 1000;

        return $entier.($reste === 0 ? '' : ','.rtrim(str_pad((string) $reste, 3, '0', STR_PAD_LEFT), '0'))."\u{00A0}%";
    }
}
