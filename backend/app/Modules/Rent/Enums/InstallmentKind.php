<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum InstallmentKind: string
{
    case Periodic = 'periodic';
    case Adjustment = 'adjustment';
}
