<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum MatchSide: string
{
    case StatementLine = 'statement_line';
    case JournalLine = 'journal_line';
}
