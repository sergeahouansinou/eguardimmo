<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

enum LineDirection: string
{
    case Credit = 'credit';
    case Debit = 'debit';
}
