<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum PaymentMethod: string
{
    case Transfer = 'transfer';
    case Cheque = 'cheque';
    case Cash = 'cash';
    case DirectDebit = 'direct_debit';
    case ChargeCredit = 'charge_credit';
    case Card = 'card';
}
