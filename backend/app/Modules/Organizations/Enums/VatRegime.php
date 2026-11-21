<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum VatRegime: string
{
    case Normal = 'normal';
    case Franchise = 'franchise';
}
