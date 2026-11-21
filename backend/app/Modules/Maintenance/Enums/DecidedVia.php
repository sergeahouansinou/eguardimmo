<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum DecidedVia: string
{
    case OwnerSpace = 'owner_space';
    case AgencyRecorded = 'agency_recorded';
}
