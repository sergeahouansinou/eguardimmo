<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\Journal;
use Carbon\CarbonImmutable;

final readonly class EntryFilters
{
    public function __construct(
        public ?Journal $journal,
        public ?string $leaseId,
        public ?CarbonImmutable $from,
        public ?CarbonImmutable $to,
        public int $perPage,
    ) {}
}
