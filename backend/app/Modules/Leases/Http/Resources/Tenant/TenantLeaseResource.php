<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Leases\Support\TenantLeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TenantLeaseView $resource
 */
final class TenantLeaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource->view;
        $bail = $vue->lease;
        $mesParties = $this->resource->myPartyIds;
        $jour = $vue->termsDay ?? $vue->today;

        return [
            ...(new TenantLeaseSummaryResource($this->resource))->toArray($request),
            'duration_months' => $bail->duration_months,
            'tacit_renewal' => $bail->tacit_renewal,
            'periodicity' => $bail->periodicity->value,
            'billing_timing' => $bail->billing_timing->value,
            'due_day' => $bail->due_day,
            'currency' => $bail->currency,
            'payment_method' => $bail->payment_method?->value,
            'signed_on' => $bail->signed_on?->toDateString(),
            'notice' => $bail->notice_received_on === null ? null : [
                'received_on' => $bail->notice_received_on->toDateString(),
                'given_by' => $bail->notice_given_by?->value,
                'departure_on' => $bail->notice_departure_on?->toDateString(),
            ],
            'units' => array_map(fn (LeaseUnit $ligne): array => [
                'unit' => isset($vue->unitData[$ligne->unit_id]) ? TenantLeaseSummaryResource::unit($vue->unitData[$ligne->unit_id]) : null,
                'is_main' => $ligne->is_main,
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ], $vue->units),
            'parties' => array_values(array_map(fn (LeaseParty $ligne): array => [
                'display_name' => $vue->partyData[$ligne->party_id]->displayName,
                'role' => $ligne->role->value,
                'is_me' => in_array($ligne->party_id, $mesParties, true),
                'joint_liability' => $ligne->joint_liability,
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ], array_filter(
                $vue->parties,
                fn (LeaseParty $ligne): bool => in_array($ligne->party_id, $mesParties, true) || LeaseView::covers($ligne->valid_from, $ligne->valid_to, $jour),
            ))),
            'terms_on' => $jour->toDateString(),
            'terms' => array_map(function (LeaseTerm $terme) use ($vue): array {
                $composante = $vue->components[$terme->component_term_id] ?? null;

                return [
                    'component' => $composante === null ? null : ['key' => $composante->key, 'label' => $composante->label(), 'semantic_key' => $composante->semanticKey],
                    'amount' => ApiShapes::money($terme->amount),
                    'vat_bp' => $terme->vat_bp,
                    'indexed' => $terme->indexed,
                    'valid_from' => $terme->valid_from->toDateString(),
                    'end_date' => ApiShapes::endDate($terme->valid_to),
                ];
            }, $vue->terms),
        ];
    }
}
