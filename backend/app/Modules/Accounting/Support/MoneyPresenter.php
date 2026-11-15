<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use Money\Money;

final class MoneyPresenter
{
    /**
     * @return array{amount: int, currency: string}
     */
    public static function present(Money $montant): array
    {
        return ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }
}
