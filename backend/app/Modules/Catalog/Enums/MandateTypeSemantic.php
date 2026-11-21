<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum MandateTypeSemantic: string
{
    case RentalManagement = 'rental_management';
    case ManagementWithSyndic = 'management_with_syndic';
    case ShortTermManagement = 'short_term_management';
    case TenantSearch = 'tenant_search';
    case Other = 'other';
}
