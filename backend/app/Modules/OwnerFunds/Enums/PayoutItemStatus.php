<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum PayoutItemStatus: string
{
    case Included = 'included';
    case Excluded = 'excluded';
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Returned = 'returned';

    public function isLive(): bool
    {
        return $this === self::Included || $this === self::Pending;
    }
}
