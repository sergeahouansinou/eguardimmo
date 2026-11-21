<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum FeeBase: string
{
    case Rent = 'rent';
    case RentAndCharges = 'rent_and_charges';
}
