<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum AnomalyKind: string
{
    case ItemOvershare = 'item_overshare';
    case StatementTotalMismatch = 'statement_total_mismatch';
    case StatementBalanceMismatch = 'statement_balance_mismatch';
    case SourceOvercap = 'source_overcap';
    case StatementEffectMissing = 'statement_effect_missing';
    case ExpenseEntryMismatch = 'expense_entry_mismatch';
}
