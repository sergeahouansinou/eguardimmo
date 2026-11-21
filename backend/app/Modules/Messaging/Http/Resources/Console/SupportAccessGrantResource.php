<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Console;

use App\Modules\Messaging\Models\SupportAccessGrant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupportAccessGrant $resource
 */
final class SupportAccessGrantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $acces = $this->resource;

        return [
            'id' => $acces->id,
            'ticket_id' => $acces->support_ticket_id,
            'organization_id' => $acces->organization_id,
            'kind' => $acces->kind->value,
            'status' => $acces->status->value,
            'scopes' => $acces->scopes,
            'reason' => $acces->reason,
            'emergency_basis' => $acces->emergency_basis?->value,
            'duration_hours' => $acces->duration_hours,
            'operator' => ['id' => $acces->operator_user_id, 'name' => $acces->operator->name],
            'requested_at' => $acces->requested_at?->toIso8601String(),
            'decided_at' => $acces->decided_at?->toIso8601String(),
            'granted_at' => $acces->granted_at?->toIso8601String(),
            'expires_at' => $acces->expires_at?->toIso8601String(),
            'revoked_at' => $acces->revoked_at?->toIso8601String(),
            'reviewed' => $acces->reviewed_at !== null,
            'reviewed_at' => $acces->reviewed_at?->toIso8601String(),
            'read_count' => $acces->read_count,
        ];
    }
}
