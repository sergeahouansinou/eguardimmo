<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use Carbon\CarbonImmutable;

final readonly class EntryData
{
    /**
     * @param  list<LineData>  $lines
     */
    public function __construct(
        public Journal $journal,
        public CarbonImmutable $date,
        public string $label,
        public SourceType $sourceType,
        public string $sourceId,
        public string $idempotencyKey,
        public array $lines,
    ) {}
}
