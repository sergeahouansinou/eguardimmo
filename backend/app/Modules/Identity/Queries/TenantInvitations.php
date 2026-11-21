<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\TenantInvitationData;
use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final readonly class TenantInvitations
{
    /**
     * Seule lecture hors contexte d'organisation : le porteur du jeton ne connaît pas l'organisation.
     */
    public function pendingByTokenHash(#[\SensitiveParameter] string $tokenHash): ?TenantInvitation
    {
        return AcrossOrganizations::query(TenantInvitation::class)
            ->where('token_hash', $tokenHash)
            ->where('status', TenantInvitationStatus::Pending)
            ->where('expires_at', '>', now())
            ->first();
    }

    /**
     * Invitation en attente ou acceptée de la partie, dans l'organisation courante.
     */
    public function liveForParty(string $partyId): ?TenantInvitation
    {
        return TenantInvitation::query()
            ->where('party_id', $partyId)
            ->whereIn('status', [TenantInvitationStatus::Pending, TenantInvitationStatus::Accepted])
            ->first();
    }

    public function data(TenantInvitation $invitation): TenantInvitationData
    {
        return new TenantInvitationData(
            id: $invitation->id,
            organizationId: $invitation->organization_id,
            organizationName: $invitation->organization_name,
            partyId: $invitation->party_id,
            emailHint: TenantInvitationToken::hint($invitation->email),
            status: $invitation->status,
            expiresAt: CarbonImmutable::instance($invitation->expires_at),
            acceptedAt: $invitation->accepted_at === null ? null : CarbonImmutable::instance($invitation->accepted_at),
        );
    }
}
