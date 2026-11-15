<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Carbon\CarbonImmutable;
use Money\Money;

final readonly class LeaseStatementData
{
    /**
     * @param  list<StatementLineData>  $lines
     */
    public function __construct(
        public string $leaseId,
        public CarbonImmutable $from,
        public CarbonImmutable $to,
        public Money $opening,
        public array $lines,
        public Money $closing,
    ) {}
}
