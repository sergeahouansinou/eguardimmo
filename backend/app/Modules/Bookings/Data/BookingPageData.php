<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

final readonly class BookingPageData
{
    /**
     * @param  list<BookingViewData>  $items
     */
    public function __construct(
        public array $items,
        public bool $hasMore,
        public ?string $nextCursor,
    ) {}
}
