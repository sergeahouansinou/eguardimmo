<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum MessageSide: string
{
    case Staff = 'staff';
    case Tenant = 'tenant';
    case Owner = 'owner';
}
