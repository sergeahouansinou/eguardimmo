<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum ReminderTiming: string
{
    case After = 'after';
    case Before = 'before';
}
