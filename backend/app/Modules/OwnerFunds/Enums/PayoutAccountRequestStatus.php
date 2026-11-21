<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum PayoutAccountRequestStatus: string
{
    case AwaitingCode = 'awaiting_code';
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
    case Expired = 'expired';

    public function isLive(): bool
    {
        return $this === self::AwaitingCode || $this === self::Pending;
    }
}
