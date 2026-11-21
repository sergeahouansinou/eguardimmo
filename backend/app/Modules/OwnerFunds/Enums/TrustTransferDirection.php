<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum TrustTransferDirection: string
{
    case WithdrawFees = 'withdraw_fees';
    case Deposit = 'deposit';
}
