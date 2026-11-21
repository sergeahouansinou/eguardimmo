<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Actions\ConsumeOwnerInvitation;
use App\Modules\Identity\Actions\IssueOwnerInvitation;
use App\Modules\Identity\Actions\RevokeOwnerInvitation;
use App\Modules\Identity\Data\IssuedOwnerInvitationData;
use App\Modules\Identity\Data\OwnerInvitationData;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Queries\OwnerInvitations as Invitations;

/**
 * Invitation d'un compte à se rattacher à un mandant (ADR 0032). Identity ne connaît pas Parties : l'appelant vérifie le
 * mandant et pose l'accès dans la même transaction que `consume()`.
 */
final readonly class OwnerInvitations
{
    public function __construct(
        private IssueOwnerInvitation $emettre,
        private ConsumeOwnerInvitation $consommer,
        private RevokeOwnerInvitation $revoquer,
        private Invitations $invitations,
    ) {}

    /**
     * Suppose un contexte d'organisation. Remplace l'invitation en attente du même mandant et de la même adresse.
     * Le code d'appariement n'est renvoyé qu'ici.
     */
    public function issue(string $mandantPartyId, ?string $personPartyId, OwnerAccessRole $role, string $organizationName, string $email, string $inviterUserId, bool $powersAttested): IssuedOwnerInvitationData
    {
        return $this->emettre->handle($mandantPartyId, $personPartyId, $role, $organizationName, $email, $inviterUserId, $powersAttested);
    }

    /**
     * Sans contexte d'organisation : le jeton désigne l'invitation. Lève owner_invitation_invalid, owner_invitation_email_mismatch
     * ou email_unverified sans rien consommer.
     */
    public function preview(string $userId, #[\SensitiveParameter] string $token): OwnerInvitationData
    {
        return $this->invitations->data($this->consommer->check($userId, $token));
    }

    /**
     * À appeler hors transaction, avant `consume()` : l'essai est compté même si la suite échoue (cinq erreurs bloquent l'invitation).
     */
    public function verifyCode(string $userId, #[\SensitiveParameter] string $token, #[\SensitiveParameter] string $code): void
    {
        $this->consommer->verifyCode($userId, $token, $code);
    }

    /**
     * À appeler dans une transaction qui pose aussi l'accès.
     */
    public function consume(string $userId, #[\SensitiveParameter] string $token, #[\SensitiveParameter] string $code, bool $consent): OwnerInvitationData
    {
        return $this->consommer->handle($userId, $token, $code, $consent);
    }

    /**
     * Suppose un contexte d'organisation. Révoque ces invitations en attente.
     *
     * @param  list<string>  $invitationIds
     */
    public function revoke(array $invitationIds, OwnerRevoker $par, ?string $actorUserId): int
    {
        return $this->revoquer->handle($invitationIds, [], $par, $actorUserId);
    }

    /**
     * Suppose un contexte d'organisation. Révoque les invitations en attente dont le mandant ou la personne est l'une de ces parties.
     *
     * @param  list<string>  $partyIds
     */
    public function revokeForParties(array $partyIds, OwnerRevoker $par, ?string $actorUserId): int
    {
        return $this->revoquer->handle([], $partyIds, $par, $actorUserId);
    }

    /**
     * Suppose un contexte d'organisation. Invitations en attente du mandant.
     *
     * @return list<OwnerInvitationData>
     */
    public function pendingForMandant(string $mandantPartyId): array
    {
        return array_values($this->invitations->pendingForMandant($mandantPartyId)->map(fn ($i): OwnerInvitationData => $this->invitations->data($i))->all());
    }

    /**
     * Suppose un contexte d'organisation. Invitations en attente du mandant, hors celle de `$exceptEmail` qu'une nouvelle invitation remplacerait.
     */
    public function countPending(string $mandantPartyId, string $exceptEmail): int
    {
        return $this->invitations->countPendingExcept($mandantPartyId, mb_strtolower(trim($exceptEmail)));
    }

    /**
     * Suppose un contexte d'organisation. Indice d'adresse (jamais l'adresse) par identifiant d'invitation.
     *
     * @param  list<string>  $invitationIds
     * @return array<string, string>
     */
    public function emailHints(array $invitationIds): array
    {
        return $this->invitations->hints($invitationIds);
    }
}
