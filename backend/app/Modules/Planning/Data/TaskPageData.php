<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

final readonly class TaskPageData
{
    /**
     * @param  list<TaskViewData>  $items
     */
    public function __construct(
        public array $items,
        public bool $hasMore,
        public ?string $nextCursor,
    ) {}
}
