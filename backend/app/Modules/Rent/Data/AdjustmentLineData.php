<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use Carbon\CarbonImmutable;
use Money\Money;

final readonly class AdjustmentLineData
{
    /**
     * @param  Money  $amount  montant strictement positif : une régularisation à rendre passe par `RentAdjustments::credit`
     */
    public function __construct(
        public int $position,
        public Money $amount,
        public string $label,
        public CarbonImmutable $notBefore,
    ) {}
}
