<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum ExpenseCategorySemantic: string
{
    case Maintenance = 'expense.maintenance';
    case Repairs = 'expense.repairs';
    case Improvements = 'expense.improvements';
    case Insurance = 'expense.insurance';
    case PropertyTax = 'expense.property_tax';
    case ManagementFees = 'expense.management_fees';
    case LoanInterest = 'expense.loan_interest';
    case Utilities = 'expense.utilities';
    case CoOwnership = 'expense.co_ownership';
    case Other = 'expense.other';
}
