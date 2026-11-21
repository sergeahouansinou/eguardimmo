<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum StatementSettlement: string
{
    case NextInstallments = 'next_installments';
    case Plan12 = 'plan_12';
    case StandaloneInstallment = 'standalone_installment';
    case Credit = 'credit';
    case None = 'none';
}
