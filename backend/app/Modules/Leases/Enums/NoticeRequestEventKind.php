<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum NoticeRequestEventKind: string
{
    case Submitted = 'submitted';
    case LetterIssued = 'letter_issued';
    case Acknowledged = 'acknowledged';
    case Withdrawn = 'withdrawn';
    case Closed = 'closed';
    case LateFlagged = 'late_flagged';
}
