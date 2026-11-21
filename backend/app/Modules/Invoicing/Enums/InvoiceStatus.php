<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Issued = 'issued';
    case PartiallyPaid = 'partially_paid';
    case Paid = 'paid';
    case Cancelled = 'cancelled';
    case Discarded = 'discarded';

    /**
     * Facture émise qui garde un reste dû possible.
     *
     * @return list<self>
     */
    public static function open(): array
    {
        return [self::Issued, self::PartiallyPaid];
    }

    /**
     * @return list<self>
     */
    public static function emitted(): array
    {
        return [self::Issued, self::PartiallyPaid, self::Paid, self::Cancelled];
    }

    public function isEmitted(): bool
    {
        return in_array($this, self::emitted(), true);
    }
}
