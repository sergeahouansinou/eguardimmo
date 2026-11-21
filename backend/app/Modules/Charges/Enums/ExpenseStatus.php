<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum ExpenseStatus: string
{
    case PendingApproval = 'pending_approval';
    case Recorded = 'recorded';
    case Cancelled = 'cancelled';
}
