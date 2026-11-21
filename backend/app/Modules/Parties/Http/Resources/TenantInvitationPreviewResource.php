<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Identity\Data\TenantInvitationData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le futur titulaire voit avant de consentir : qui l'invite, jusqu'à quand. Rien sur la partie.
 *
 * @property TenantInvitationData $resource
 */
final class TenantInvitationPreviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'organization' => ['name' => $this->resource->organizationName],
            'expires_at' => $this->resource->expiresAt->toIso8601String(),
        ];
    }
}
