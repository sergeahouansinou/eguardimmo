<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

use App\Modules\Accounting\Enums\AccountRole;

enum LedgerRole: string
{
    case Bank = 'bank';
    case TrustBank = 'trust_bank';

    public function accountRole(): AccountRole
    {
        return match ($this) {
            self::Bank => AccountRole::Bank,
            self::TrustBank => AccountRole::TrustBank,
        };
    }
}
