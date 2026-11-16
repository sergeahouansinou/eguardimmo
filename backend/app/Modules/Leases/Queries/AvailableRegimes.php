<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\RegimeData;
use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Properties\PublicApi\UnitDirectory;

final readonly class AvailableRegimes
{
    public function __construct(
        private LeaseRegimes $regimes,
        private UnitDirectory $lots,
    ) {}

    /**
     * Le bail suit le lieu du bien : les régimes proposés sont ceux du pays du site du lot.
     * Lève unit_not_found hors de l'organisation et jurisdiction_unsupported si le pays n'a aucun régime.
     *
     * @return list<RegimeData>
     */
    public function forUnit(string $unitId): array
    {
        $pays = $this->lots->find($unitId)->address['country'];

        return array_map(
            static fn (LeaseRegime $regime): RegimeData => RegimeData::from($regime),
            $this->regimes->all($pays),
        );
    }
}
