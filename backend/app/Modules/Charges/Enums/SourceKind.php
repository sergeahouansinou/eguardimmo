<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum SourceKind: string
{
    case Expense = 'expense';
    case SupplierInvoice = 'supplier_invoice';
}
