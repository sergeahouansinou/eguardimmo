<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum LeasePhase: string
{
    case Draft = 'draft';
    case Upcoming = 'upcoming';
    case Running = 'running';
    case Notice = 'notice';
    case Ended = 'ended';
}
