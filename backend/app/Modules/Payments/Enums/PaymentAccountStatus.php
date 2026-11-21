<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum PaymentAccountStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Restricted = 'restricted';
}
