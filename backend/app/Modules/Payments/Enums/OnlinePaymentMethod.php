<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum OnlinePaymentMethod: string
{
    case Card = 'card';
    case DirectDebit = 'direct_debit';
}
