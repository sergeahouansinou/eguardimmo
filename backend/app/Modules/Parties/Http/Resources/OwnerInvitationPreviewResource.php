<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Identity\Data\OwnerInvitationData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le futur titulaire voit avant d'être apparié : l'agence, le rôle, l'échéance. Rien sur le mandant.
 *
 * @property OwnerInvitationData $resource
 */
final class OwnerInvitationPreviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'organization' => ['name' => $this->resource->organizationName],
            'role' => $this->resource->role->value,
            'expires_at' => $this->resource->expiresAt->toIso8601String(),
        ];
    }
}
