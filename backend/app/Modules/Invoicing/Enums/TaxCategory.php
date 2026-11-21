<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

/**
 * Catégories de taxe de la norme EN 16931 (UNCL5305).
 */
enum TaxCategory: string
{
    case Standard = 'S';
    case ZeroRated = 'Z';
    case Exempt = 'E';
    case ReverseCharge = 'AE';
    case OutsideScope = 'O';
}
