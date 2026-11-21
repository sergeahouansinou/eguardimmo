<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Organization;

use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Support\OperatorLabel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'organisation : jamais l'identifiant ni le nom complet de l'opérateur, jamais le compte qui a décidé.
 *
 * @property SupportAccessGrant $resource
 */
final class SupportAccessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $acces = $this->resource;

        return [
            'id' => $acces->id,
            'kind' => $acces->kind->value,
            'status' => $acces->status->value,
            'scopes' => $acces->scopes,
            'reason' => $acces->reason,
            'emergency_basis' => $acces->emergency_basis?->value,
            'ticket_reference' => $acces->ticket->reference,
            'operator' => OperatorLabel::of($acces->operator->name),
            'duration_hours' => $acces->duration_hours,
            'requested_at' => $acces->requested_at?->toIso8601String(),
            'decided_at' => $acces->decided_at?->toIso8601String(),
            'granted_at' => $acces->granted_at?->toIso8601String(),
            'expires_at' => $acces->expires_at?->toIso8601String(),
            'revoked_at' => $acces->revoked_at?->toIso8601String(),
            'reviewed' => $acces->reviewed_at !== null,
            'read_count' => $acces->read_count,
        ];
    }
}
