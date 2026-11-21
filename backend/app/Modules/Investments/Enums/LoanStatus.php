<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum LoanStatus: string
{
    case Active = 'active';
    case Repaid = 'repaid';
    case Archived = 'archived';
    case Voided = 'voided';
}
