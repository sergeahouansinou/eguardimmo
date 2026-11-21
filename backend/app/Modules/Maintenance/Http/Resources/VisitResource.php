<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\InterventionVisit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InterventionVisit $resource
 */
final class VisitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $v = $this->resource;

        return [
            'id' => $v->id,
            'intervention_id' => $v->intervention_id,
            'supplier_party_id' => $v->supplier_party_id,
            'scheduled_on' => $v->scheduled_on->toDateString(),
            'slot' => $v->slot->value,
            'presence_required' => $v->presence_required,
            'status' => $v->status->value,
            'requested_on' => $v->requested_on?->toDateString(),
            'requested_slot' => $v->requested_slot?->value,
            'contact_name' => $v->contact_name,
            'contact_phone' => $v->contact_phone,
            'lock_version' => $v->lock_version,
        ];
    }
}
