<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Data\PlacementData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Mandates\Data\MandateCoverageData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;

/**
 * Résout bien, mandat, mandant et plafond d'une intervention : tout vient des PublicApi de l'organisation courante, rien du client.
 * Le plafond est celui du jour de la qualification et reste figé ensuite (ADR 0029).
 */
final readonly class Placements
{
    public function __construct(
        private UnitDirectory $lots,
        private MandateDirectory $mandats,
    ) {}

    public function resolve(?string $unitId, ?string $propertyId, ?string $mandateId, CarbonImmutable $jour, bool $selfManaged, bool $urgent): PlacementData
    {
        $lot = $unitId === null ? null : $this->lots->find($unitId);
        $bien = $lot === null ? $propertyId : $lot->propertyId;

        if ($selfManaged) {
            return new PlacementData($bien, $unitId, null, null, null, null, false);
        }

        $couverture = $unitId === null ? $this->forCommonParts($bien, $mandateId, $jour) : $this->mandats->coveringUnit($unitId, $jour);

        if ($couverture === null) {
            if ($urgent) {
                return new PlacementData($bien, $unitId, null, null, null, null, false);
            }

            throw ErrorCode::NoMandate->problem();
        }

        if ($couverture->isSuspended && ! $urgent) {
            throw ErrorCode::MandateSuspended->problem();
        }

        return new PlacementData($bien, $unitId, $couverture->mandateId, $couverture->mandantPartyId, $couverture->worksLimitAmount, $couverture->currency, $couverture->isSuspended);
    }

    private function forCommonParts(?string $propertyId, ?string $mandateId, CarbonImmutable $jour): ?MandateCoverageData
    {
        if ($mandateId === null || $propertyId === null) {
            return null;
        }

        $mandat = $this->mandats->find($mandateId);
        $lots = $this->lots->findMany($mandat->unitIds);

        foreach ($lots as $lot) {
            if ($lot->propertyId === $propertyId) {
                $couverture = $this->mandats->coveringUnit($lot->id, $jour);

                if ($couverture !== null && $couverture->mandateId === $mandat->id) {
                    return $couverture;
                }
            }
        }

        return null;
    }
}
