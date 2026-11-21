<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum TargetType: string
{
    case JournalLine = 'journal_line';
    case Lease = 'lease';
    case Invoice = 'invoice';
}
