<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;

final readonly class NewListingData
{
    /**
     * @param  array<string, mixed>  $fields  champs validés, déjà limités à la liste blanche
     */
    public function __construct(
        public ListingKind $kind,
        public ListingCategory $category,
        public array $fields,
    ) {}
}
