<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum SuggestionAction: string
{
    case Match = 'match';
    case SettleLease = 'settle_lease';
    case SettleInvoice = 'settle_invoice';
    case BankCharges = 'bank_charges';
    case Ignore = 'ignore';
}
