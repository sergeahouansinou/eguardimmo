<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use Carbon\CarbonImmutable;

final readonly class PostedEntryData
{
    /**
     * @param  list<PostedLineData>  $lines
     */
    public function __construct(
        public string $id,
        public int $fiscalYear,
        public int $number,
        public Journal $journal,
        public CarbonImmutable $date,
        public string $label,
        public SourceType $sourceType,
        public string $sourceId,
        public string $idempotencyKey,
        public ?string $reversalOfId,
        public array $lines,
        public bool $replayed,
    ) {}

    public function reference(): string
    {
        return sprintf('%d-%06d', $this->fiscalYear, $this->number);
    }
}
