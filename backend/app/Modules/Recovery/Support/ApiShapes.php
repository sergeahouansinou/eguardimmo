<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use Money\Money;

final class ApiShapes
{
    /**
     * @return array{amount: int, currency: string}
     */
    public static function money(Money $montant): array
    {
        return ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }
}
