<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum SupplierInvoiceStatus: string
{
    case Recorded = 'recorded';
    case Allocated = 'allocated';
    case Cancelled = 'cancelled';
}
