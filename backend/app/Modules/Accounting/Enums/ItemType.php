<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum ItemType: string
{
    case Installment = 'installment';
    case Invoice = 'invoice';
}
