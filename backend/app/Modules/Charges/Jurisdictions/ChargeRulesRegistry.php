<?php

declare(strict_types=1);

namespace App\Modules\Charges\Jurisdictions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Jurisdictions\Fr\FrChargeRules;

final readonly class ChargeRulesRegistry
{
    /** @var array<string, ChargeRules> */
    private array $index;

    public function __construct()
    {
        $index = [];

        foreach ([new FrChargeRules] as $regles) {
            $index[$regles->jurisdiction()] = $regles;
        }

        $this->index = $index;
    }

    /**
     * Aucun repli : une juridiction sans règles de régularisation est refusée.
     */
    public function for(string $jurisdiction): ChargeRules
    {
        return $this->index[strtoupper($jurisdiction)] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }

    public function supports(string $jurisdiction): bool
    {
        return isset($this->index[strtoupper($jurisdiction)]);
    }
}
