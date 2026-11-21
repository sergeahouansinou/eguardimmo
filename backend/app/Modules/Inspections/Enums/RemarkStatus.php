<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

enum RemarkStatus: string
{
    case Open = 'open';
    case Answered = 'answered';
}
