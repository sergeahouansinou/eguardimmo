<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Support\LeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseView $resource
 */
final class LeaseSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource;
        $bail = $vue->lease;
        $principal = $vue->mainUnit();

        return [
            'id' => $bail->id,
            'reference' => $bail->reference,
            'jurisdiction' => $bail->jurisdiction,
            'regime_key' => $bail->regime_key,
            'status' => $bail->status->value,
            'phase' => $vue->phase->value,
            'starts_on' => $bail->starts_on->toDateString(),
            'end_date' => ApiShapes::endDate($bail->ends_on),
            'duration_months' => $bail->duration_months,
            'tacit_renewal' => $bail->tacit_renewal,
            'periodicity' => $bail->periodicity->value,
            'currency' => $bail->currency,
            'main_unit' => $principal === null || ! isset($vue->unitData[$principal->unit_id]) ? null : ApiShapes::unit($vue->unitData[$principal->unit_id]),
            'tenants' => array_map(
                fn (LeaseParty $lien): array => ApiShapes::party($vue->partyData[$lien->party_id]),
                $vue->tenants(),
            ),
            'lock_version' => $bail->lock_version,
            'archived_at' => $bail->archived_at?->toIso8601String(),
        ];
    }
}
