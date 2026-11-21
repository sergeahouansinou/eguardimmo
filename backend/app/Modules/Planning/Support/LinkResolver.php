<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Planning\Data\PlanningLinks;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Http\ApiProblem;

/**
 * Vérifie bien, lot et bail auprès de leurs modules. Tout refus (inconnu, autre organisation, lot d'un autre bien) se présente de
 * la même façon, `planning_link_invalid`, pour ne pas révéler l'existence d'un identifiant. Un bail doit occuper le lot (ou un lot du bien) indiqué.
 */
final readonly class LinkResolver
{
    public function __construct(
        private UnitDirectory $lots,
        private LeaseDirectory $baux,
    ) {}

    public function resolve(?string $propertyId, ?string $unitId, ?string $leaseId): PlanningLinks
    {
        try {
            if ($unitId !== null) {
                $lot = $this->lots->find($unitId);

                if ($propertyId !== null && $propertyId !== $lot->propertyId) {
                    throw ErrorCode::LinkInvalid->problem();
                }

                $propertyId = $lot->propertyId;
            } elseif ($propertyId !== null) {
                $this->lots->findProperty($propertyId);
            }

            if ($leaseId !== null) {
                $bail = $this->baux->find($leaseId);
                $lotsDuBail = array_map(fn (LeaseUnitData $l): string => $l->unitId, $bail->units);

                if ($unitId !== null && ! in_array($unitId, $lotsDuBail, true)) {
                    throw ErrorCode::LinkInvalid->problem();
                }

                if ($unitId === null && $propertyId !== null && ! $this->bienDuBail($lotsDuBail, $propertyId)) {
                    throw ErrorCode::LinkInvalid->problem();
                }
            }
        } catch (ApiProblem $e) {
            throw $e->problemCode === ErrorCode::LinkInvalid->value ? $e : ErrorCode::LinkInvalid->problem();
        }

        return new PlanningLinks($propertyId, $unitId, $leaseId);
    }

    /**
     * @param  list<string>  $lotsDuBail
     */
    private function bienDuBail(array $lotsDuBail, string $propertyId): bool
    {
        foreach ($lotsDuBail === [] ? [] : $this->lots->findMany($lotsDuBail) as $lot) {
            if ($lot->propertyId === $propertyId) {
                return true;
            }
        }

        return false;
    }
}
