<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum IgnoreReason: string
{
    case OutOfScope = 'out_of_scope';
    case InternalTransfer = 'internal_transfer';
    case BankError = 'bank_error';
    case Other = 'other';
}
