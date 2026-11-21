<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Jurisdictions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Jurisdictions\Fr\FrOwnerFundsRules;

final class OwnerFundsJurisdictions
{
    /** @var array<string, OwnerFundsRules> */
    private array $index;

    public function __construct(FrOwnerFundsRules $fr)
    {
        $this->index = [$fr->jurisdiction() => $fr];
    }

    /**
     * Aucun repli : une juridiction sans règles de fonds de mandants est refusée.
     */
    public function for(string $jurisdiction): OwnerFundsRules
    {
        return $this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }
}
