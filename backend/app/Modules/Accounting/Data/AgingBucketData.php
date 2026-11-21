<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Money\Money;

final readonly class AgingBucketData
{
    /**
     * @param  string  $key  `0_30`, `31_60`, `61_90` ou `over_90`
     * @param  int  $count  nombre de créances ouvertes de la tranche
     */
    public function __construct(
        public string $key,
        public Money $amount,
        public int $count,
    ) {}
}
