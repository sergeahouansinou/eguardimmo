<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum AccountStatus: string
{
    case Active = 'active';
    case Closed = 'closed';
}
