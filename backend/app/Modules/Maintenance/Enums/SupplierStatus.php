<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum SupplierStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Archived = 'archived';
}
