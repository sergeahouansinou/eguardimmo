<?php

declare(strict_types=1);

namespace App\Modules\Investments\PublicApi;

use App\Modules\Investments\Data\AcquisitionData;
use App\Modules\Investments\Queries\LoanFacts;

/**
 * Coût de revient et date d'acquisition des biens de l'organisation courante.
 */
final readonly class Acquisitions
{
    public function __construct(private LoanFacts $faits) {}

    /**
     * @param  list<string>|null  $propertyIds  null : tous les biens ; liste vide : aucun
     * @return list<AcquisitionData>
     */
    public function forProperties(?array $propertyIds = null): array
    {
        return $this->faits->acquisitions($propertyIds);
    }
}
