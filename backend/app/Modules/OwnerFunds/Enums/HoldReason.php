<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum HoldReason: string
{
    case Dispute = 'dispute';
    case MandateEnding = 'mandate_ending';
    case WorksReserve = 'works_reserve';
    case Succession = 'succession';
    case AccountChangeContested = 'account_change_contested';
    case Other = 'other';
}
