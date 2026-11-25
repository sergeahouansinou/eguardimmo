<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingSort;

final readonly class ListingFilters
{
    /**
     * @param  list<string>  $amenities
     */
    public function __construct(
        public ?string $place,
        public ?ListingKind $kind,
        public ?ListingCategory $category,
        public ?int $guests,
        public ?int $minPrice,
        public ?int $maxPrice,
        public array $amenities,
        public ListingSort $sort,
        public int $perPage,
        public ?string $after,
    ) {}
}
