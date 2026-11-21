<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use Money\Currencies\ISOCurrencies;
use Money\Currency;

final class MoneyText
{
    /**
     * @param  non-empty-string  $currency
     */
    public static function format(int $amount, string $currency): string
    {
        $decimales = (new ISOCurrencies)->subunitFor(new Currency($currency));
        $texte = number_format(abs($amount) / (10 ** $decimales), $decimales, ',', "\u{202F}");

        return ($amount < 0 ? '-' : '').$texte."\u{00A0}".$currency;
    }
}
