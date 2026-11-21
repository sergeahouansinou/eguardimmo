<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum PayoutBatchStatus: string
{
    case Draft = 'draft';
    case Validated = 'validated';
    case Executed = 'executed';
    case Cancelled = 'cancelled';
}
