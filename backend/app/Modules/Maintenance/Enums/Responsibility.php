<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum Responsibility: string
{
    case Owner = 'owner';
    case Tenant = 'tenant';
    case Shared = 'shared';
    case Undetermined = 'undetermined';
}
