<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum TicketPriority: string
{
    case High = 'high';
    case Normal = 'normal';
    case Low = 'low';
}
