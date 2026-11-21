<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum VisitSlot: string
{
    case Morning = 'morning';
    case Afternoon = 'afternoon';
    case Evening = 'evening';
}
