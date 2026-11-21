<?php

declare(strict_types=1);

namespace App\Modules\Planning\Enums;

enum TaskStatus: string
{
    case Open = 'open';
    case Done = 'done';
    case Cancelled = 'cancelled';
}
