<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum InterventionOrigin: string
{
    case Tenant = 'tenant';
    case Team = 'team';
}
