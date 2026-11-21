<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum LineState: string
{
    case Unmatched = 'unmatched';
    case Matched = 'matched';
    case Ignored = 'ignored';
}
