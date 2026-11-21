<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Http\Support\ApiShapes;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Support\MandateView;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property MandateView $resource
 */
final class MandateSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource;
        $mandat = $vue->mandate;
        $conditions = $vue->termsAt(CarbonImmutable::today()->toDateString());

        return [
            'id' => $mandat->id,
            'reference' => $mandat->reference,
            'status' => $mandat->status->value,
            'mandant' => ApiShapes::party($vue->mandant),
            'mandate_type' => ApiShapes::type($vue->type),
            'starts_on' => $mandat->starts_on->toDateString(),
            'end_date' => ApiShapes::endDate($mandat->ends_on),
            'tacit_renewal' => $mandat->tacit_renewal,
            'currency' => $mandat->currency,
            'units' => array_map(
                fn (MandateUnit $ligne): array => ApiShapes::line($ligne, $vue->unitData),
                array_values(array_filter($vue->units, fn (MandateUnit $l): bool => $l->valid_to === null)),
            ),
            'terms' => $conditions === null ? null : ApiShapes::terms($conditions),
            'has_end_request' => $vue->hasEndRequest,
            'lock_version' => $mandat->lock_version,
            'archived_at' => $mandat->archived_at?->toIso8601String(),
        ];
    }
}
