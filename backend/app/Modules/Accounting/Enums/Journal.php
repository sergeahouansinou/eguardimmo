<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum Journal: string
{
    case Rent = 'rent';
    case Bank = 'bank';
    case Fees = 'fees';
    case Deposits = 'deposits';
    case Recovery = 'recovery';
    case Adjustments = 'adjustments';
}
