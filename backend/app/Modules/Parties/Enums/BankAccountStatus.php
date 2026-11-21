<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum BankAccountStatus: string
{
    case Active = 'active';
    case Pending = 'pending';
    case Rejected = 'rejected';
}
