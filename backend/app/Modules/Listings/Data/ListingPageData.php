<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

final readonly class ListingPageData
{
    /**
     * @param  list<ListingViewData>  $items
     */
    public function __construct(
        public array $items,
        public bool $hasMore,
        public ?string $nextCursor,
    ) {}
}
