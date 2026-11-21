<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum SuspensionReason: string
{
    case Fraud = 'fraud';
    case Abuse = 'abuse';
    case LegalOrder = 'legal_order';
    case Security = 'security';
}
