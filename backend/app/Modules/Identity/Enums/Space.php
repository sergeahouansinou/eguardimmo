<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum Space: string
{
    case Tenant = 'tenant';
    case Owner = 'owner';
    case Organization = 'organization';
    case Operator = 'operator';
}
