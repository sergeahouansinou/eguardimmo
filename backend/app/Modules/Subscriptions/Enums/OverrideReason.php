<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Enums;

/**
 * Motif d'une dérogation, en liste fermée : le texte libre reste dans la demande de double validation, jamais dans le journal.
 */
enum OverrideReason: string
{
    case CommercialGesture = 'commercial_gesture';
    case Migration = 'migration';
    case Incident = 'incident';
    case Pilot = 'pilot';
}
