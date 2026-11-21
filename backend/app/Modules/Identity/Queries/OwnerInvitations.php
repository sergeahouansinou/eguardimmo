<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\OwnerInvitationData;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Support\OwnerInvitationCode;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

final readonly class OwnerInvitations
{
    /**
     * Seule lecture par jeton, hors contexte d'organisation : le porteur du jeton ne connaît pas l'organisation.
     */
    public function pendingByTokenHash(#[\SensitiveParameter] string $tokenHash): ?OwnerInvitation
    {
        return AcrossOrganizations::query(OwnerInvitation::class)
            ->where('token_hash', $tokenHash)
            ->where('status', OwnerInvitationStatus::Pending)
            ->where('expires_at', '>', now())
            ->first();
    }

    /**
     * Invitations en attente dont l'échéance est passée, toutes organisations confondues.
     *
     * @return Collection<int, OwnerInvitation>
     */
    public function expiredAt(CarbonInterface $now): Collection
    {
        return AcrossOrganizations::query(OwnerInvitation::class)
            ->where('status', OwnerInvitationStatus::Pending)
            ->where('expires_at', '<=', $now)
            ->get(['id', 'organization_id']);
    }

    /**
     * Invitations en attente adressées à cette adresse, toutes organisations confondues (suppression du compte).
     *
     * @return Collection<int, OwnerInvitation>
     */
    public function pendingForEmail(string $email): Collection
    {
        return AcrossOrganizations::query(OwnerInvitation::class)
            ->where('status', OwnerInvitationStatus::Pending)
            ->where('email', mb_strtolower(trim($email)))
            ->get(['id', 'organization_id']);
    }

    /**
     * Invitations en attente du mandant, dans l'organisation courante.
     *
     * @return Collection<int, OwnerInvitation>
     */
    public function pendingForMandant(string $mandantPartyId): Collection
    {
        return OwnerInvitation::query()
            ->where('mandant_party_id', $mandantPartyId)
            ->where('status', OwnerInvitationStatus::Pending)
            ->where('expires_at', '>', now())
            ->orderBy('created_at')
            ->get();
    }

    public function countPendingExcept(string $mandantPartyId, string $email): int
    {
        return OwnerInvitation::query()
            ->where('mandant_party_id', $mandantPartyId)
            ->where('status', OwnerInvitationStatus::Pending)
            ->where('expires_at', '>', now())
            ->where('email', '<>', $email)
            ->count();
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string> indice d'adresse par identifiant d'invitation, dans l'organisation courante
     */
    public function hints(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return OwnerInvitation::query()->whereIn('id', $ids)->pluck('email', 'id')
            ->map(fn (mixed $email): string => TenantInvitationToken::hint((string) $email))
            ->all();
    }

    /**
     * @param  list<string>  $partyIds
     * @return Collection<int, OwnerInvitation>
     */
    public function pendingForParties(array $partyIds): Collection
    {
        return OwnerInvitation::query()
            ->where('status', OwnerInvitationStatus::Pending)
            ->where(fn ($q) => $q->whereIn('mandant_party_id', $partyIds)->orWhereIn('person_party_id', $partyIds))
            ->lockForUpdate()
            ->get();
    }

    public function data(OwnerInvitation $invitation): OwnerInvitationData
    {
        return new OwnerInvitationData(
            id: $invitation->id,
            organizationId: $invitation->organization_id,
            organizationName: $invitation->organization_name,
            mandantPartyId: $invitation->mandant_party_id,
            personPartyId: $invitation->person_party_id,
            role: $invitation->role,
            emailHint: TenantInvitationToken::hint($invitation->email),
            status: $invitation->status,
            expiresAt: CarbonImmutable::instance($invitation->expires_at),
            attemptsRemaining: max(0, OwnerInvitationCode::ESSAIS_MAX - $invitation->code_attempts),
            identityAttestedByUserId: $invitation->invited_by_user_id,
            identityAttestedAt: CarbonImmutable::instance($invitation->identity_attested_at),
            acceptedAt: $invitation->accepted_at === null ? null : CarbonImmutable::instance($invitation->accepted_at),
            consentVersion: OwnerInvitation::CONSENT_VERSION,
        );
    }
}
