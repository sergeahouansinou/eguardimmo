<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

enum LineKind: string
{
    case RentCalled = 'rent_called';
    case RentCollected = 'rent_collected';
    case Advance = 'advance';
    case Fee = 'fee';
    case FeeVat = 'fee_vat';
    case Works = 'works';
    case Payout = 'payout';
    case Adjustment = 'adjustment';
    case Arrears = 'arrears';

    public function section(): ReportSection
    {
        return match ($this) {
            self::RentCalled, self::RentCollected, self::Advance, self::Adjustment => ReportSection::Rent,
            self::Fee, self::FeeVat => ReportSection::Fees,
            self::Works => ReportSection::Works,
            self::Payout => ReportSection::Payout,
            self::Arrears => ReportSection::Arrears,
        };
    }

    public function isInformative(): bool
    {
        return $this === self::RentCalled || $this === self::Arrears;
    }
}
