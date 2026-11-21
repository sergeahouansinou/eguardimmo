<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum PrepaymentOption: string
{
    case ReduceTerm = 'reduce_term';
    case ReducePayment = 'reduce_payment';
}
