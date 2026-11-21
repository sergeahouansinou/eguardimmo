<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Http\Resources\MandateEndRequestResource;
use App\Modules\Mandates\Http\Support\ApiShapes;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Support\OwnerMandateView;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le mandant voit de son mandat : période, honoraires, préavis, jour de reversement et lots. Jamais la note interne, la note de
 * résiliation, le motif, les champs personnalisés, le plafond de travaux ni l'identifiant du fichier signé.
 *
 * @property OwnerMandateView $resource
 */
final class OwnerMandateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource->view;
        $mandat = $vue->mandate;
        $terme = $vue->termsAt(CarbonImmutable::today()->toDateString());

        return [
            'id' => $mandat->id,
            'reference' => $mandat->reference,
            'status' => $mandat->status->value,
            'type' => ['key' => $vue->type->key, 'label' => $vue->type->label()],
            'agency' => ['id' => $mandat->organization_id, 'name' => $this->resource->agencyName],
            'mandant' => ['name' => $this->resource->visible->mandantName],
            'starts_on' => $mandat->starts_on->toDateString(),
            'end_date' => ApiShapes::endDate($mandat->ends_on),
            'tacit_renewal' => $mandat->tacit_renewal,
            'renewal_months' => $mandat->renewal_months,
            'notice_months' => $mandat->notice_months,
            'currency' => $mandat->currency,
            'signed_on' => $mandat->signed_on?->toDateString(),
            'notice_given_on' => $mandat->notice_given_on?->toDateString(),
            'end_request' => $this->resource->endRequest === null ? null : (new MandateEndRequestResource($this->resource->endRequest))->resolve(),
            'terms' => $terme === null ? null : self::terms($terme),
            'units' => array_map(fn (MandateUnit $ligne): array => [
                'id' => $ligne->unit_id,
                'reference' => $vue->unitData[$ligne->unit_id]->reference ?? null,
                'property_name' => $vue->unitData[$ligne->unit_id]->propertyName ?? null,
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ], $vue->units),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function terms(MandateTerm $terme): array
    {
        return [
            'fee_kind' => $terme->fee_kind->value,
            'fee_basis_points' => $terme->fee_basis_points,
            'fee_flat_amount' => $terme->fee_flat_amount === null ? null : ApiShapes::money($terme->fee_flat_amount),
            'fee_base' => $terme->fee_base?->value,
            'fee_minimum_amount' => ApiShapes::money($terme->fee_minimum_amount),
            'fee_tax_mode' => $terme->fee_tax_mode->value,
            'letting_fee_basis_points' => $terme->letting_fee_basis_points,
            'works_fee_basis_points' => $terme->works_fee_basis_points,
            'payout_day' => $terme->payout_day,
            'valid_from' => $terme->valid_from->toDateString(),
        ];
    }
}
