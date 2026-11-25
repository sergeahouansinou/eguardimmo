<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Models\MandateEndRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le mandant ne reçoit jamais la note de décision de l'agence.
 *
 * @property MandateEndRequest $resource
 */
final class OwnerMandateEndRequestResource extends JsonResource
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
        ];
    }
}
