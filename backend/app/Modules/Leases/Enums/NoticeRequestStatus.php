<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum NoticeRequestStatus: string
{
    case Submitted = 'submitted';
    case Acknowledged = 'acknowledged';
    case Withdrawn = 'withdrawn';
    case Closed = 'closed';
}
