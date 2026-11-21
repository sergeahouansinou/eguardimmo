<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum InvoiceItemSemantic: string
{
    case FeeManagement = 'fee.management';
    case FeeLetting = 'fee.letting';
    case FeeOther = 'fee.other';
    case Service = 'service';
    case RecoveryCost = 'recovery_cost';
}
