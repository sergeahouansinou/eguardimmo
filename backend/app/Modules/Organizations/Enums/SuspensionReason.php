<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

/**
 * Jamais l'impayé : le défaut de paiement ramène au plan Gratuit, il ne suspend rien (ADR 0013).
 */
enum SuspensionReason: string
{
    case Fraud = 'fraud';
    case Abuse = 'abuse';
    case LegalOrder = 'legal_order';
    case Security = 'security';
}
