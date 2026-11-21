<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ApprovalBasis: string
{
    case UnderCeiling = 'under_ceiling';
    case OwnerApproved = 'owner_approved';
    case Emergency = 'emergency';
    case SelfManaged = 'self_managed';
}
