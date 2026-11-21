<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum TaxCategory: string
{
    case Standard = 'S';
    case Zero = 'Z';
    case Exempt = 'E';
    case ReverseCharge = 'AE';
    case OutsideScope = 'O';
}
