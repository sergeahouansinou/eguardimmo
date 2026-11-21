<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Money\Money;

final readonly class AgingData
{
    /**
     * Reste dû des créances ouvertes (locataires et clients) par ancienneté depuis la date comptable de la créance.
     *
     * @param  list<AgingBucketData>  $buckets  toujours les quatre tranches, dans l'ordre
     */
    public function __construct(
        public array $buckets,
        public Money $total,
        public int $count,
    ) {}
}
