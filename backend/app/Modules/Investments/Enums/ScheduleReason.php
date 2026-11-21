<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum ScheduleReason: string
{
    case Initial = 'initial';
    case Import = 'import';
    case Prepayment = 'prepayment';
    case Renegotiation = 'renegotiation';
}
