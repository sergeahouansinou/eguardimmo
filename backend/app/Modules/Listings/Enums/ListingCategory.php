<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum ListingCategory: string
{
    case Studio = 'studio';
    case Apartment = 'apartment';
    case House = 'house';
    case Shared = 'shared';
}
