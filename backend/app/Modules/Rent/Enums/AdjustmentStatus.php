<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum AdjustmentStatus: string
{
    case Pending = 'pending';
    case Billed = 'billed';
    case Cancelled = 'cancelled';
}
