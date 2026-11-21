<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum FeeTaxMode: string
{
    case ExclTax = 'excl_tax';
    case InclTax = 'incl_tax';
}
