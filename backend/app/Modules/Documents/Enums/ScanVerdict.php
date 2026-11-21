<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum ScanVerdict: string
{
    case Clean = 'clean';
    case Infected = 'infected';
    case Unverifiable = 'unverifiable';
}
