<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum ListingSort: string
{
    case Relevance = 'relevance';
    case PriceAsc = 'price_asc';
    case PriceDesc = 'price_desc';
    case Recent = 'recent';
}
