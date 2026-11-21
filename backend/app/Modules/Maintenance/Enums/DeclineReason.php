<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum DeclineReason: string
{
    case Duplicate = 'duplicate';
    case OutOfScope = 'out_of_scope';
    case NotAnIssue = 'not_an_issue';
    case TenantResponsibility = 'tenant_responsibility';
    case Other = 'other';
}
