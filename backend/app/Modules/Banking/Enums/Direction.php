<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

use App\Modules\Accounting\Enums\Side;

enum Direction: string
{
    case Credit = 'credit';
    case Debit = 'debit';

    /**
     * Un crédit du relevé répond à un débit du compte de banque au grand livre, et inversement.
     */
    public function ledgerSide(): Side
    {
        return $this === self::Credit ? Side::Debit : Side::Credit;
    }

    public function sign(): int
    {
        return $this === self::Credit ? 1 : -1;
    }
}
