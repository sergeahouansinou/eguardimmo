<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

final readonly class PropertyContactPageData
{
    /**
     * @param  list<PropertyContactData>  $items
     */
    public function __construct(
        public array $items,
        public bool $hasMore,
        public ?string $nextCursor,
    ) {}
}
