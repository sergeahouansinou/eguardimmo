<?php

declare(strict_types=1);

namespace App\Modules\Rent\Jurisdictions;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Jurisdictions\Fr\FrRentDocumentRules;

final readonly class RentRules
{
    /** @var array<string, RentDocumentRules> */
    private array $index;

    public function __construct()
    {
        $index = [];

        foreach ([new FrRentDocumentRules] as $regles) {
            $index[$regles->jurisdiction()] = $regles;
        }

        $this->index = $index;
    }

    /**
     * Aucun repli : une juridiction sans modèle de pièce est refusée.
     */
    public function for(string $jurisdiction): RentDocumentRules
    {
        return $this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }
}
