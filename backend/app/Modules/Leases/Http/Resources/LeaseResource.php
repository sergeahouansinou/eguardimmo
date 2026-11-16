<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseView $resource
 */
final class LeaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource;
        $bail = $vue->lease;
        $voitLesDonneesSensibles = $this->voitLesDonneesSensibles($request);

        return [
            ...(new LeaseSummaryResource($vue))->toArray($request),
            'billing_timing' => $bail->billing_timing->value,
            'due_day' => $bail->due_day,
            'payment_method' => $bail->payment_method?->value,
            'signed_on' => $bail->signed_on?->toDateString(),
            'signed_file_id' => $bail->signed_file_id,
            'notice' => $bail->notice_received_on === null ? null : [
                'received_on' => $bail->notice_received_on->toDateString(),
                'given_by' => $bail->notice_given_by?->value,
                'departure_on' => $bail->notice_departure_on?->toDateString(),
                'reason' => $bail->termination_reason,
            ],
            'jurisdiction_data' => (object) $bail->jurisdiction_data,
            'custom_fields' => (object) $bail->custom_fields,
            'note' => $voitLesDonneesSensibles ? $bail->note : null,
            'units' => array_map(fn (LeaseUnit $ligne): array => [
                'id' => $ligne->id,
                'unit' => isset($vue->unitData[$ligne->unit_id]) ? ApiShapes::unit($vue->unitData[$ligne->unit_id]) : ['id' => $ligne->unit_id],
                'is_main' => $ligne->is_main,
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ], $vue->units),
            'parties' => array_map(fn (LeaseParty $ligne): array => [
                'id' => $ligne->id,
                'party' => ApiShapes::party($vue->partyData[$ligne->party_id]),
                'role' => $ligne->role->value,
                'joint_liability' => $ligne->joint_liability,
                'guarantees_party_id' => $ligne->guarantees_party_id,
                'guarantee' => $ligne->guarantee_limit_amount === null || ! $voitLesDonneesSensibles ? null : [
                    'limit' => ApiShapes::money($ligne->guarantee_limit_amount),
                    'ends_on' => $ligne->guarantee_ends_on?->toDateString(),
                ],
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ], $vue->parties),
            'terms' => array_map(
                fn ($terme): array => (new LeaseTermResource($terme, $vue))->toArray($request),
                $vue->terms,
            ),
            'lock_version' => $bail->lock_version,
        ];
    }

    private function voitLesDonneesSensibles(Request $request): bool
    {
        $utilisateur = $request->user();

        if ($utilisateur === null) {
            return false;
        }

        $adhesion = app(MembershipDirectory::class)->activeMembership((string) $utilisateur->getKey(), app(CurrentOrganization::class)->id());

        return $adhesion !== null && $adhesion->role !== MemberRole::Accountant;
    }
}
