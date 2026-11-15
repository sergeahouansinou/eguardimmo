<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum TicketStatus: string
{
    case Open = 'open';
    case Waiting = 'waiting';
    case Resolved = 'resolved';
}
