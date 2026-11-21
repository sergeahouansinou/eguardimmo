<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum PaymentStatus: string
{
    case Recorded = 'recorded';
    case Cancelled = 'cancelled';
}
