<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum DeferralKind: string
{
    case None = 'none';
    case Partial = 'partial';
    case Total = 'total';
}
