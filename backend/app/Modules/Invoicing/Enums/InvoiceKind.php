<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

enum InvoiceKind: string
{
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';

    public function prefix(): string
    {
        return match ($this) {
            self::Invoice => 'FA',
            self::CreditNote => 'AF',
        };
    }
}
