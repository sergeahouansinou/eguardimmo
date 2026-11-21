<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum ExpenseKind: string
{
    case Payment = 'payment';
    case CoOwnershipStatement = 'co_ownership_statement';
}
