<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Enums;

use App\Modules\Accounting\Enums\ItemType as LedgerItemType;

enum ItemType: string
{
    case Installment = 'installment';
    case Invoice = 'invoice';

    public function ledgerType(): LedgerItemType
    {
        return match ($this) {
            self::Installment => LedgerItemType::Installment,
            self::Invoice => LedgerItemType::Invoice,
        };
    }
}
