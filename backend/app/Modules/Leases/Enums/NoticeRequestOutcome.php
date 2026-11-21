<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum NoticeRequestOutcome: string
{
    case Recorded = 'recorded';
    case Superseded = 'superseded';
}
