<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

final readonly class ActivityPageData
{
    /**
     * @param  list<ActivityEntryData>  $entries
     */
    public function __construct(
        public array $entries,
        public bool $hasMore,
        public ?string $nextCursor,
    ) {}
}
