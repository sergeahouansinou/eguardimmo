<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum PushResult: string
{
    case Sent = 'sent';
    case InvalidToken = 'invalid_token';
    case Failed = 'failed';
    case Disabled = 'disabled';
}
