<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum InsuranceSubmissionStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
}
