<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum LeaseAnomalyKind: string
{
    case UnitOverlap = 'unit_overlap';
    case NoTenant = 'no_tenant';
    case NoMainUnit = 'no_main_unit';
    case NoRent = 'no_rent';
    case UnitArchived = 'unit_archived';
    case UnitMissing = 'unit_missing';
    case TermOverlap = 'term_overlap';
    case CurrencyMismatch = 'currency_mismatch';
}
