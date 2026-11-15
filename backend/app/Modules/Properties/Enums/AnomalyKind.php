<?php

declare(strict_types=1);

namespace App\Modules\Properties\Enums;

enum AnomalyKind: string
{
    case ShareExceeded = 'share_exceeded';
    case InvalidShare = 'invalid_share';
    case InvalidPeriod = 'invalid_period';
}
