<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Parties\Data\TenantAccessData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TenantAccessData $resource
 */
final class TenantAccessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'party_id' => $this->resource->partyId,
            'status' => $this->resource->status,
            'email_hint' => $this->resource->emailHint,
            'expires_at' => $this->resource->expiresAt?->toIso8601String(),
            'linked_at' => $this->resource->linkedAt?->toIso8601String(),
        ];
    }
}
