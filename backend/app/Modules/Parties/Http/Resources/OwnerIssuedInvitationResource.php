<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Identity\Data\IssuedOwnerInvitationData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le code d'appariement n'apparaît que dans cette réponse : l'agence le remet hors e-mail.
 *
 * @property IssuedOwnerInvitationData $resource
 */
final class OwnerIssuedInvitationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $invitation = $this->resource->invitation;

        return [
            'party_id' => $invitation->mandantPartyId,
            'invitation' => [
                'id' => $invitation->id,
                'role' => $invitation->role->value,
                'person_party_id' => $invitation->personPartyId,
                'email_hint' => $invitation->emailHint,
                'expires_at' => $invitation->expiresAt->toIso8601String(),
                'attempts_remaining' => $invitation->attemptsRemaining,
            ],
            'pairing_code' => $this->resource->pairingCode,
        ];
    }
}
