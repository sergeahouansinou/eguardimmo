<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum SupplierPaymentMethod: string
{
    case Transfer = 'transfer';
    case Cheque = 'cheque';
    case Cash = 'cash';
    case Card = 'card';
    case DirectDebit = 'direct_debit';
}
