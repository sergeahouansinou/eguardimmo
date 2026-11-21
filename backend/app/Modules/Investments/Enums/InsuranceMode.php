<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum InsuranceMode: string
{
    case None = 'none';
    case InitialCapital = 'initial_capital';
    case OutstandingCapital = 'outstanding_capital';
    case Fixed = 'fixed';
}
