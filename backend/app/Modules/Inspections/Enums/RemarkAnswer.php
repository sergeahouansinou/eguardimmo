<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

enum RemarkAnswer: string
{
    case Accepted = 'accepted';
    case Refused = 'refused';
    case Noted = 'noted';
}
