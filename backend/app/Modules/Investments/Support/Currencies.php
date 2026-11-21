<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use LogicException;
use Money\Currencies\ISOCurrencies;
use Money\Currency;
use Money\Money;

final class Currencies
{
    public static function of(string $code): Currency
    {
        return $code !== '' ? new Currency($code) : throw new LogicException('Devise absente.');
    }

    public static function decimals(string $code): int
    {
        return (new ISOCurrencies)->subunitFor(self::of($code));
    }

    public static function money(mixed $montant, string $code): Money
    {
        return is_int($montant) || (is_string($montant) && is_numeric($montant)) ? new Money($montant, self::of($code)) : throw new LogicException('Montant non entier lu en base.');
    }
}
