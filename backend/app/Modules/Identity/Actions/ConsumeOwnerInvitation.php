<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\OwnerInvitationData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\OwnerInvitations;
use App\Modules\Identity\Support\OwnerInvitationCode;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class ConsumeOwnerInvitation
{
    public function __construct(
        private OwnerInvitations $invitations,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Vérifie sans consommer : le jeton existe, n'est ni expiré, ni utilisé, ni bloqué, et le compte porte l'adresse invitée, confirmée.
     */
    public function check(string $userId, #[\SensitiveParameter] string $jeton): OwnerInvitation
    {
        $compte = User::query()->find($userId) ?? throw ErrorCode::OwnerInvitationInvalid->problem();

        if ($compte->email_verified_at === null) {
            throw ErrorCode::EmailUnverified->problem();
        }

        $invitation = $this->invitations->pendingByTokenHash(TenantInvitationToken::hash($jeton))
            ?? throw ErrorCode::OwnerInvitationInvalid->problem();

        if (mb_strtolower($compte->email) !== $invitation->email) {
            throw ErrorCode::OwnerInvitationEmailMismatch->problem();
        }

        return $invitation;
    }

    /**
     * Compte l'essai dans sa propre transaction : l'échec doit survivre à l'annulation de la transaction de l'appelant.
     * À appeler hors de toute transaction ; la cinquième erreur bloque l'invitation.
     */
    public function verifyCode(string $userId, #[\SensitiveParameter] string $jeton, #[\SensitiveParameter] string $code): void
    {
        $invitation = $this->check($userId, $jeton);

        $refuse = $this->contexte->run($invitation->organization_id, fn (): bool => DB::transaction(function () use ($invitation, $userId, $jeton, $code): bool {
            $verrouillee = $this->verrouillee($invitation, $jeton);

            if (OwnerInvitationCode::matches($verrouillee->id, $verrouillee->code_hash, $code)) {
                return false;
            }

            $tentatives = $verrouillee->code_attempts + 1;
            $bloquee = $tentatives >= OwnerInvitationCode::ESSAIS_MAX;
            $verrouillee->forceFill($bloquee
                ? ['code_attempts' => $tentatives, ...$verrouillee->endedAttributes(OwnerInvitationStatus::Blocked)]
                : ['code_attempts' => $tentatives])->save();

            if ($bloquee) {
                $this->audit->handle('identity.owner_invitation.blocked', $userId, ['mandant_party_id' => $verrouillee->mandant_party_id], $verrouillee);
            }

            return true;
        }));

        if ($refuse) {
            throw ErrorCode::OwnerInvitationCodeInvalid->problem();
        }
    }

    /**
     * À appeler dans la transaction de l'appelant, après verifyCode() : l'accès et l'acceptation réussissent ou échouent ensemble.
     */
    public function handle(string $userId, #[\SensitiveParameter] string $jeton, #[\SensitiveParameter] string $code, bool $consent): OwnerInvitationData
    {
        if (! $consent) {
            throw ErrorCode::OwnerInvitationConsentRequired->problem();
        }

        $invitation = $this->check($userId, $jeton);

        return $this->contexte->run($invitation->organization_id, function () use ($invitation, $userId, $jeton, $code): OwnerInvitationData {
            $verrouillee = $this->verrouillee($invitation, $jeton);

            if (! OwnerInvitationCode::matches($verrouillee->id, $verrouillee->code_hash, $code)) {
                throw ErrorCode::OwnerInvitationCodeInvalid->problem();
            }

            $verrouillee->forceFill([
                ...$verrouillee->endedAttributes(OwnerInvitationStatus::Accepted),
                'accepted_by_user_id' => $userId,
                'accepted_at' => now(),
                'consent_version' => OwnerInvitation::CONSENT_VERSION,
            ])->save();

            $this->audit->handle('identity.owner_invitation.accepted', $userId, ['mandant_party_id' => $verrouillee->mandant_party_id, 'role' => $verrouillee->role->value, 'consent_version' => OwnerInvitation::CONSENT_VERSION], $verrouillee);

            return $this->invitations->data($verrouillee);
        });
    }

    private function verrouillee(OwnerInvitation $invitation, #[\SensitiveParameter] string $jeton): OwnerInvitation
    {
        $verrouillee = OwnerInvitation::query()->whereKey($invitation->id)->lockForUpdate()->first();

        if ($verrouillee === null
            || $verrouillee->status !== OwnerInvitationStatus::Pending
            || $verrouillee->token_hash !== TenantInvitationToken::hash($jeton)
            || $verrouillee->expires_at->isPast()) {
            throw ErrorCode::OwnerInvitationInvalid->problem();
        }

        return $verrouillee;
    }
}
