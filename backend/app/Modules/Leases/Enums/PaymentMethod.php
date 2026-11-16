<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum PaymentMethod: string
{
    case Transfer = 'transfer';
    case DirectDebit = 'direct_debit';
    case Card = 'card';
    case Cheque = 'cheque';
    case Cash = 'cash';
}
