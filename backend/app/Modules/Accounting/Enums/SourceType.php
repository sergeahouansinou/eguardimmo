<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum SourceType: string
{
    case Installment = 'installment';
    case Payment = 'payment';
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';
    case Deposit = 'deposit';
    case RecoveryFee = 'recovery_fee';
    case Adjustment = 'adjustment';
    case JournalEntry = 'journal_entry';
}
