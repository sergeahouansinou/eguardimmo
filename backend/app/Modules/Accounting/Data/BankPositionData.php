<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Money\Money;

final readonly class BankPositionData
{
    /**
     * @param  Money  $balance  débit moins crédit, signé
     */
    public function __construct(
        public Money $balance,
        public int $lineCount,
    ) {}
}
