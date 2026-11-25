<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum PriceUnit: string
{
    case Night = 'night';
    case Month = 'month';
}
