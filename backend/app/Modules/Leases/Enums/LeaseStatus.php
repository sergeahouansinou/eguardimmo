<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum LeaseStatus: string
{
    case Draft = 'draft';
    case Signed = 'signed';
    case Terminated = 'terminated';
    case Cancelled = 'cancelled';
}
