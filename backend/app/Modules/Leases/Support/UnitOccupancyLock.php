<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class UnitOccupancyLock
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * Verrouille un ensemble de lots dans l'ordre croissant de leurs identifiants : deux transactions qui visent des
     * lots communs se croisent dans le même ordre et ne s'interbloquent pas. À appeler dans la transaction qui écrit les occupations.
     *
     * @param  list<string>  $unitIds
     */
    public function acquire(array $unitIds): void
    {
        $ordonnes = array_values(array_unique($unitIds));
        sort($ordonnes, SORT_STRING);

        foreach ($ordonnes as $unitId) {
            $this->compteur->next('lease_unit_locks', ['organization_id' => $this->organisation->id(), 'unit_id' => $unitId]);
        }
    }
}
