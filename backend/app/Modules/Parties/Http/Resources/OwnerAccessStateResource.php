<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Identity\Data\OwnerInvitationData;
use App\Modules\Parties\Data\OwnerAccessStateData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'agence : adresses masquées, jamais le jeton ni le code d'appariement.
 *
 * @property OwnerAccessStateData $resource
 */
final class OwnerAccessStateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'party_id' => $this->resource->partyId,
            'accesses' => $this->resource->accesses,
            'invitations' => array_map(fn (OwnerInvitationData $i): array => [
                'id' => $i->id,
                'role' => $i->role->value,
                'person_party_id' => $i->personPartyId,
                'email_hint' => $i->emailHint,
                'expires_at' => $i->expiresAt->toIso8601String(),
                'attempts_remaining' => $i->attemptsRemaining,
            ], $this->resource->invitations),
        ];
    }
}
