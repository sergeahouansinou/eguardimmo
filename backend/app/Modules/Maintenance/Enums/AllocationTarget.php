<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum AllocationTarget: string
{
    case Owner = 'owner';
    case Deposit = 'deposit';
}
