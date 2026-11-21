<?php

declare(strict_types=1);

namespace App\Modules\Properties\PublicApi;

use App\Modules\Properties\Data\OwnerShareData;
use App\Modules\Properties\Queries\Ownerships;
use App\Modules\Properties\Queries\Units;
use DateTimeInterface;

/**
 * Propriétaires d'un lot ; suppose un contexte d'organisation.
 */
final readonly class OwnershipDirectory
{
    public function __construct(
        private Units $units,
        private Ownerships $ownerships,
    ) {}

    /**
     * Droits en vigueur à cette date (période semi-ouverte : la date de fin n'en fait plus partie).
     * Lève unit_not_found hors de l'organisation courante.
     *
     * @return list<OwnerShareData>
     */
    public function ownersAt(string $unitId, DateTimeInterface $date): array
    {
        return $this->ownerships->ownersAt($this->units->get($unitId)->id, $date);
    }

    /**
     * Comme `ownersAt()` pour plusieurs lots, en une lecture ; un identifiant hors de l'organisation courante n'a simplement aucun droit.
     *
     * @param  list<string>  $unitIds
     * @return array<string, list<OwnerShareData>>
     */
    public function ownersAtMany(array $unitIds, DateTimeInterface $date): array
    {
        return $this->ownerships->ownersAtMany($unitIds, $date);
    }
}
