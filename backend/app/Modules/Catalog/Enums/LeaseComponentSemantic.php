<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum LeaseComponentSemantic: string
{
    case Rent = 'rent';
    case ChargesProvision = 'charges_provision';
    case ChargesFlat = 'charges_flat';
    case RentSupplement = 'rent_supplement';
    case Deposit = 'deposit';
    case TaxRecoverable = 'tax_recoverable';
}
