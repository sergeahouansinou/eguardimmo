<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum CoverageState: string
{
    case Valid = 'valid';
    case Expiring = 'expiring';
    case Missing = 'missing';
}
