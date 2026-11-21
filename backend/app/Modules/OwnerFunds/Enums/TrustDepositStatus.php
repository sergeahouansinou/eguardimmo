<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum TrustDepositStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
}
