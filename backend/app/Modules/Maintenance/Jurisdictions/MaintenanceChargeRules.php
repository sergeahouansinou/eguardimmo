<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Jurisdictions;

interface MaintenanceChargeRules
{
    public function jurisdiction(): string;

    /**
     * Refuse (`allocation_not_chargeable`) une nature qui n'est pas à la charge du locataire dans cette juridiction.
     */
    public function assertChargeable(bool $natureTenantChargeable): void;

    /**
     * Part retenue sur le dépôt après vétusté, en unités mineures, arrondie au plus proche (demi vers le haut).
     */
    public function retainedAmount(int $grossShare, int $wearBasisPoints): int;
}
