<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum ListingKind: string
{
    case ShortStay = 'short_stay';
    case LongTerm = 'long_term';

    public function priceUnit(): PriceUnit
    {
        return $this === self::ShortStay ? PriceUnit::Night : PriceUnit::Month;
    }
}
