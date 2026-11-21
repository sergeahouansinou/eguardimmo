<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ActorKind: string
{
    case Team = 'team';
    case Owner = 'owner';
    case Tenant = 'tenant';
    case System = 'system';
}
