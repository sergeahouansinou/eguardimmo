<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum MatchKind: string
{
    case Suggested = 'suggested';
    case Manual = 'manual';
    case Settled = 'settled';
}
