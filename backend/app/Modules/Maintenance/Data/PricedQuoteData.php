<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class PricedQuoteData
{
    /**
     * @param  list<PricedLineData>  $lines
     * @param  list<TaxBucketData>  $buckets
     */
    public function __construct(
        public array $lines,
        public array $buckets,
        public int $net,
        public int $tax,
    ) {}

    public function gross(): int
    {
        return $this->net + $this->tax;
    }
}
