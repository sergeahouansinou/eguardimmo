<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ReportedUrgency: string
{
    case Urgent = 'urgent';
    case Soon = 'soon';
    case Normal = 'normal';
}
