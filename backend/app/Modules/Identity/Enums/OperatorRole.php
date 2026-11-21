<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum OperatorRole: string
{
    case Admin = 'admin';
    case Support = 'support';
    case Compliance = 'compliance';
    case Billing = 'billing';
    case Engineering = 'engineering';
}
