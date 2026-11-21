<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum OnClosedPeriod: string
{
    case Refuse = 'refuse';
    case RollForward = 'roll_forward';
}
