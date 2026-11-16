<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum Periodicity: string
{
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Semiannual = 'semiannual';
    case Annual = 'annual';
}
