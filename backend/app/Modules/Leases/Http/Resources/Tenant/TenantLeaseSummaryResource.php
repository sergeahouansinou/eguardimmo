<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Support\TenantLeaseView;
use App\Modules\Properties\Data\UnitData;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le locataire voit d'un bail : jamais la note interne, les champs personnalisés, les garanties ni les données de juridiction.
 *
 * @property TenantLeaseView $resource
 */
final class TenantLeaseSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource->view;
        $bail = $vue->lease;
        $principal = $vue->mainUnit();
        $fin = $bail->effectiveEnd();

        return [
            'id' => $bail->id,
            'reference' => $bail->reference,
            'regime_key' => $bail->regime_key,
            'status' => $bail->status->value,
            'phase' => $vue->phase->value,
            'starts_on' => $bail->starts_on->toDateString(),
            'end_date' => $fin === null ? null : ApiShapes::endDate(CarbonImmutable::parse($fin)),
            'organization' => ['id' => $bail->organization_id, 'name' => $this->resource->organizationName],
            'main_unit' => $principal === null || ! isset($vue->unitData[$principal->unit_id]) ? null : self::unit($vue->unitData[$principal->unit_id]),
            'access' => ['until' => $this->resource->accessUntil, 'in_grace' => $this->resource->inGrace],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function unit(UnitData $lot): array
    {
        return [
            'reference' => $lot->reference,
            'type' => $lot->unitTypeKey,
            'floor' => $lot->floor,
            'surface_hundredths' => $lot->surfaceHundredths,
            'property' => ['name' => $lot->propertyName, 'address' => $lot->address],
        ];
    }
}
