<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use LogicException;
use Money\Currency;

final class Currencies
{
    public static function of(string $code): Currency
    {
        return $code !== '' ? new Currency($code) : throw new LogicException('Devise absente.');
    }
}
