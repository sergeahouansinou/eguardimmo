<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum LeasePartyRole: string
{
    case Tenant = 'tenant';
    case Guarantor = 'guarantor';
    case Occupant = 'occupant';
}
