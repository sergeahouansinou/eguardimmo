<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum ReceiptState: string
{
    case Issued = 'issued';
    case OnDemand = 'on_demand';
    case Pending = 'pending';
    case NotDue = 'not_due';
}
