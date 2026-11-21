<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum InstallmentStatus: string
{
    case Upcoming = 'upcoming';
    case Issued = 'issued';
    case PartiallyPaid = 'partially_paid';
    case Paid = 'paid';
    case Cancelled = 'cancelled';

    /**
     * Appelée au grand livre et pas encore soldée.
     */
    public function isOpen(): bool
    {
        return $this === self::Issued || $this === self::PartiallyPaid;
    }

    /**
     * @return list<self>
     */
    public static function open(): array
    {
        return [self::Issued, self::PartiallyPaid];
    }
}
