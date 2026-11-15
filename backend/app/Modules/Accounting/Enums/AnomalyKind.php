<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum AnomalyKind: string
{
    case Unbalanced = 'unbalanced';
    case TooFewLines = 'too_few_lines';
    case InvalidLine = 'invalid_line';
    case NumberingGap = 'numbering_gap';
}
