<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources\Tenant;

use App\Modules\Parties\Models\ContactUpdateRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le locataire retrouve l'état de sa demande, jamais les valeurs ni l'identifiant de sa fiche.
 *
 * @mixin ContactUpdateRequest
 */
final class TenantContactUpdateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'status' => $this->status->value,
            'created_at' => $this->created_at->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
        ];
    }
}
