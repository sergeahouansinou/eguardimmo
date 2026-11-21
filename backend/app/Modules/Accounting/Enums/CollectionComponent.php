<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum CollectionComponent: string
{
    case Rent = 'rent';
    case Charges = 'charges';
    case Vat = 'vat';
    case Advance = 'advance';
    case Unresolved = 'unresolved';
}
