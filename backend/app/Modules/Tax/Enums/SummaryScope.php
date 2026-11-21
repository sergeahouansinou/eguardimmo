<?php

declare(strict_types=1);

namespace App\Modules\Tax\Enums;

enum SummaryScope: string
{
    case Organization = 'organization';
    case Mandant = 'mandant';
}
