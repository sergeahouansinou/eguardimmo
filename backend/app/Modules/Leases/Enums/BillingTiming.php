<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum BillingTiming: string
{
    case Advance = 'advance';
    case Arrears = 'arrears';
}
