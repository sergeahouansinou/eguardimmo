<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use LogicException;
use Money\Currency;
use Money\Money;

final class MoneyColumns
{
    public static function money(mixed $valeur, Currency $devise): Money
    {
        if (is_int($valeur) || (is_string($valeur) && is_numeric($valeur))) {
            return new Money($valeur, $devise);
        }

        throw new LogicException('Montant non entier lu en base.');
    }

    public static function currency(mixed $code): Currency
    {
        if (is_string($code) && $code !== '') {
            return new Currency($code);
        }

        throw new LogicException('Devise absente lue en base.');
    }
}
