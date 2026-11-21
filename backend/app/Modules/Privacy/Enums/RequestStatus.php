<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum RequestStatus: string
{
    case Received = 'received';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Refused = 'refused';

    public function isOpen(): bool
    {
        return $this === self::Received || $this === self::InProgress;
    }
}
