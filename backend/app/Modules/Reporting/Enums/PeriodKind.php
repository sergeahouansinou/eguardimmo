<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

enum PeriodKind: string
{
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Custom = 'custom';
}
