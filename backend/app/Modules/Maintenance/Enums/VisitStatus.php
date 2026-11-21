<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum VisitStatus: string
{
    case Proposed = 'proposed';
    case Confirmed = 'confirmed';
    case RescheduleRequested = 'reschedule_requested';
    case Done = 'done';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';
}
