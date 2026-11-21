<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Support;

use Money\Money;

final class Shapes
{
    /**
     * @return array{amount: int, currency: string}
     */
    public static function money(Money $montant): array
    {
        return ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }

    /**
     * @return array{amount: int, currency: string}|null
     */
    public static function moneyOrNull(?Money $montant): ?array
    {
        return $montant === null ? null : self::money($montant);
    }
}
