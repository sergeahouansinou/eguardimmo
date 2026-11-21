<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum EmergencyBasis: string
{
    case SecurityIncident = 'security_incident';
    case LegalRequisition = 'legal_requisition';
}
