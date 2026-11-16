<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum NoticeGivenBy: string
{
    case Tenant = 'tenant';
    case Landlord = 'landlord';
}
