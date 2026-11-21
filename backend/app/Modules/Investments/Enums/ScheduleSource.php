<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum ScheduleSource: string
{
    case Computed = 'computed';
    case Imported = 'imported';
}
