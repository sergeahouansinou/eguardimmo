<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use Money\Money;

final class MoneyShape
{
    /**
     * @return array{amount: int, currency: string}
     */
    public static function of(Money $montant): array
    {
        return ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }

    /**
     * @return array{amount: int, currency: string}
     */
    public static function minor(int $montant, string $devise): array
    {
        return ['amount' => $montant, 'currency' => $devise];
    }
}
