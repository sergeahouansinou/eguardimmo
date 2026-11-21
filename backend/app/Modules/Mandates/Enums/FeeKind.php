<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum FeeKind: string
{
    case Percentage = 'percentage';
    case Flat = 'flat';
}
