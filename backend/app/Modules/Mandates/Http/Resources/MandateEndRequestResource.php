<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Models\MandateEndRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property MandateEndRequest $resource
 */
final class MandateEndRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $demande = $this->resource;

        return [
            'id' => $demande->id,
            'mandate_id' => $demande->mandate_id,
            'status' => $demande->status->value,
            'reason' => $demande->reason,
            'requested_at' => $demande->created_at->toIso8601String(),
            'cancelled_at' => $demande->cancelled_at?->toIso8601String(),
            'decided_at' => $demande->decided_at?->toIso8601String(),
            'decision_note' => $demande->decision_note,
        ];
    }
}
