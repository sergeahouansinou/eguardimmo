<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum UnitTypeSemantic: string
{
    case Residential = 'residential';
    case Parking = 'parking';
    case Commercial = 'commercial';
    case Storage = 'storage';
    case Land = 'land';
}
