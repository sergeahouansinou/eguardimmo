<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Jurisdictions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Jurisdictions\Fr\FrManagementReportRules;

final class ManagementReportJurisdictions
{
    /** @var array<string, ManagementReportRules> */
    private array $index;

    public function __construct(FrManagementReportRules $fr)
    {
        $this->index = [$fr->jurisdiction() => $fr];
    }

    public function supports(string $jurisdiction): bool
    {
        return isset($this->index[$jurisdiction]);
    }

    /**
     * Aucun repli : une juridiction sans règles de compte rendu est refusée.
     */
    public function for(string $jurisdiction): ManagementReportRules
    {
        return $this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }
}
