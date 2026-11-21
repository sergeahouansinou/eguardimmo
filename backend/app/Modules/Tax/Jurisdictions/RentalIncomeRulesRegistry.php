<?php

declare(strict_types=1);

namespace App\Modules\Tax\Jurisdictions;

use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Jurisdictions\Fr\FrRentalIncomeRules;

final readonly class RentalIncomeRulesRegistry
{
    /** @var array<string, RentalIncomeRules> */
    private array $index;

    /**
     * @param  list<RentalIncomeRules>|null  $regles  null : les règles livrées ; seul un test fournit les siennes
     */
    public function __construct(?array $regles = null)
    {
        $index = [];

        foreach ($regles ?? [new FrRentalIncomeRules] as $regles) {
            $index[$regles->jurisdiction()] = $regles;
        }

        $this->index = $index;
    }

    /**
     * Aucun repli : une juridiction sans règles de revenus fonciers est refusée.
     */
    public function for(string $jurisdiction): RentalIncomeRules
    {
        return $this->index[strtoupper($jurisdiction)] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }

    public function supports(string $jurisdiction): bool
    {
        return isset($this->index[strtoupper($jurisdiction)]);
    }
}
