<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum ExpenseSettlement: string
{
    case Bank = 'bank';
    case Cash = 'cash';
    case Trust = 'trust';
    case OwnFundsAdvance = 'own_funds_advance';
    case PaidByOwner = 'paid_by_owner';
    case None = 'none';

    public function postsToLedger(): bool
    {
        return ! in_array($this, [self::PaidByOwner, self::None], true);
    }

    public function agencyOnly(): bool
    {
        return in_array($this, [self::Trust, self::OwnFundsAdvance, self::PaidByOwner], true);
    }

    public function movesThirdPartyFunds(): bool
    {
        return in_array($this, [self::Trust, self::OwnFundsAdvance], true);
    }

    public function needsDocument(): bool
    {
        return in_array($this, [self::Trust, self::PaidByOwner, self::None], true);
    }
}
