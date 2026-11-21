<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

enum ApprovalStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Expired = 'expired';
    case Cancelled = 'cancelled';
    case Failed = 'failed';
}
