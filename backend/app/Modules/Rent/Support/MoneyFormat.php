<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

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
            'USD' => '$',
            default => $devise,
        };

        return ($montant < 0 ? '-' : '').number_format($entier, 0, '', "\u{202F}").$partie."\u{00A0}".$symbole;
    }
}
