<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

enum ReportSection: string
{
    case Rent = 'rent';
    case Fees = 'fees';
    case Payout = 'payout';
    case Arrears = 'arrears';
    case Works = 'works';
    case Receipts = 'receipts';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $s): string => $s->value, self::cases());
    }
}
