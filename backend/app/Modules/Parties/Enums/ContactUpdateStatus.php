<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum ContactUpdateStatus: string
{
    case Pending = 'pending';
    case Applied = 'applied';
    case Dismissed = 'dismissed';
}
