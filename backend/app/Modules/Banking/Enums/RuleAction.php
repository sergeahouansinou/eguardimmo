<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum RuleAction: string
{
    case SuggestLease = 'suggest_lease';
    case SuggestBankCharges = 'suggest_bank_charges';
    case SuggestIgnore = 'suggest_ignore';
}
