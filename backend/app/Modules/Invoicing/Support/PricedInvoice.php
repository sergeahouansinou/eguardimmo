<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

final readonly class PricedInvoice
{
    /**
     * @param  list<PricedLine>  $lines
     * @param  list<TaxGroup>  $taxes
     */
    public function __construct(
        public array $lines,
        public array $taxes,
        public int $net,
        public int $tax,
        public string $currency,
    ) {}

    public function gross(): int
    {
        return $this->net + $this->tax;
    }
}
