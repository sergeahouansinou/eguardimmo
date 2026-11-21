<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Actions\ConsumeTenantInvitation;
use App\Modules\Identity\Actions\IssueTenantInvitation;
use App\Modules\Identity\Actions\RevokeTenantInvitations;
use App\Modules\Identity\Data\TenantInvitationData;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Queries\TenantInvitations as Invitations;

/**
 * Invitation d'un compte à se rattacher à une partie locataire (ADR 0024). Identity ne connaît pas Parties : l'appelant
 * vérifie la partie et pose le rattachement dans la même transaction que `consume()`.
 */
final readonly class TenantInvitations
{
    public function __construct(
        private IssueTenantInvitation $emettre,
        private ConsumeTenantInvitation $consommer,
        private RevokeTenantInvitations $revoquer,
        private Invitations $invitations,
    ) {}

    /**
     * Suppose un contexte d'organisation. Remplace l'invitation en attente de la partie ; refuse si elle est déjà rattachée.
     */
    public function issue(string $partyId, string $organizationName, string $email, string $inviterUserId): TenantInvitationData
    {
        return $this->emettre->handle($partyId, $organizationName, $email, $inviterUserId);
    }

    /**
     * Sans contexte d'organisation : le jeton désigne l'invitation. Lève tenant_invitation_invalid, tenant_invitation_email_mismatch
     * ou email_unverified sans rien consommer.
     */
    public function preview(string $userId, #[\SensitiveParameter] string $token): TenantInvitationData
    {
        return $this->invitations->data($this->consommer->check($userId, $token));
    }

    /**
     * À appeler dans une transaction qui pose aussi le rattachement de la partie.
     */
    public function consume(string $userId, #[\SensitiveParameter] string $token, bool $consent): TenantInvitationData
    {
        return $this->consommer->handle($userId, $token, $consent);
    }

    /**
     * Suppose un contexte d'organisation. Retourne vrai si une invitation en attente ou acceptée a été révoquée.
     */
    public function revokeForParty(string $partyId, TenantRevoker $par, ?string $actorUserId): bool
    {
        return $this->revoquer->handle($partyId, $par, $actorUserId);
    }

    /**
     * Suppose un contexte d'organisation. Invitation en attente ou acceptée de la partie.
     */
    public function liveForParty(string $partyId): ?TenantInvitationData
    {
        $invitation = $this->invitations->liveForParty($partyId);

        return $invitation === null ? null : $this->invitations->data($invitation);
    }
}
