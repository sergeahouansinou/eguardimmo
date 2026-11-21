<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum LoanPurpose: string
{
    case Acquisition = 'acquisition';
    case Works = 'works';
    case Refinancing = 'refinancing';
    case Other = 'other';
}
