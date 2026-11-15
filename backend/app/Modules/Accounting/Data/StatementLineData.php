<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\Journal;
use Carbon\CarbonImmutable;
use Money\Money;

final readonly class StatementLineData
{
    public function __construct(
        public string $entryId,
        public string $reference,
        public CarbonImmutable $date,
        public Journal $journal,
        public string $label,
        public Money $debit,
        public Money $credit,
        public Money $balance,
    ) {}
}
