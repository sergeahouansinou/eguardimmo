<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Jurisdictions\Fr;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Jurisdictions\MaintenanceChargeRules;

/**
 * Décret n° 87-712 du 26 août 1987 (réparations locatives) et loi n° 89-462, art. 22 (retenue sur le dépôt, justificatifs,
 * vétusté). Sources secondaires : la grille de vétusté et les natures à la charge du locataire sont à valider (ADR 0011).
 */
final class FrMaintenanceChargeRules implements MaintenanceChargeRules
{
    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function assertChargeable(bool $natureTenantChargeable): void
    {
        if (! $natureTenantChargeable) {
            throw ErrorCode::AllocationNotChargeable->problem();
        }
    }

    public function retainedAmount(int $grossShare, int $wearBasisPoints): int
    {
        return intdiv($grossShare * (10000 - $wearBasisPoints) + 5000, 10000);
    }
}
