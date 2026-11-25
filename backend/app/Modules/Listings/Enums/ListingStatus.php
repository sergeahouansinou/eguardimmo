<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum ListingStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
