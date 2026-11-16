<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Models\Lease;
use LogicException;
use Money\Currency;

final class DraftCurrency
{
    public static function of(Lease $bail): Currency
    {
        return $bail->currency !== '' ? new Currency($bail->currency) : throw new LogicException('Devise du bail absente.');
    }
}
