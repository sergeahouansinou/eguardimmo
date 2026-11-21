<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Jurisdictions;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Jurisdictions\Fr\FrMaintenanceChargeRules;

final class ChargeRules
{
    /** @var array<string, MaintenanceChargeRules> */
    private array $index;

    public function __construct(FrMaintenanceChargeRules $fr)
    {
        $this->index = [$fr->jurisdiction() => $fr];
    }

    /**
     * Aucun repli : une juridiction sans règles d'imputation au locataire est refusée (ADR 0008).
     */
    public function for(string $jurisdiction): MaintenanceChargeRules
    {
        return $this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }
}
