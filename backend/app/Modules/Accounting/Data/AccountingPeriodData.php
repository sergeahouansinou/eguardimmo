<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Carbon\CarbonImmutable;

final readonly class AccountingPeriodData
{
    /**
     * @param  CarbonImmutable  $end  premier jour du mois suivant (exclu)
     */
    public function __construct(
        public string $id,
        public CarbonImmutable $start,
        public CarbonImmutable $end,
        public CarbonImmutable $closedAt,
        public ?string $closedByUserId,
        public string $cutoff,
        public bool $replayed,
    ) {}
}
