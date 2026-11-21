<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum EndRequestStatus: string
{
    case Pending = 'pending';
    case Cancelled = 'cancelled';
    case Dismissed = 'dismissed';
    case Fulfilled = 'fulfilled';
}
