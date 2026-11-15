<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum RequesterSpace: string
{
    case Tenant = 'tenant';
    case Owner = 'owner';
    case Organization = 'organization';
    case Marketplace = 'marketplace';
}
