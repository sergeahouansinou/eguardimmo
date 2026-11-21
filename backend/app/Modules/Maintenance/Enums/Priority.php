<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum Priority: string
{
    case Urgent = 'urgent';
    case Normal = 'normal';
    case Low = 'low';
}
