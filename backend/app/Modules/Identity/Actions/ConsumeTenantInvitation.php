<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\TenantInvitationData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\TenantInvitations;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class ConsumeTenantInvitation
{
    public function __construct(
        private TenantInvitations $invitations,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Vérifie sans consommer : le jeton existe, n'est ni expiré ni utilisé, et le compte porte l'adresse invitée, confirmée.
     */
    public function check(string $userId, #[\SensitiveParameter] string $jeton): TenantInvitation
    {
        $compte = User::query()->find($userId) ?? throw ErrorCode::TenantInvitationInvalid->problem();

        if ($compte->email_verified_at === null) {
            throw ErrorCode::EmailUnverified->problem();
        }

        $invitation = $this->invitations->pendingByTokenHash(TenantInvitationToken::hash($jeton))
            ?? throw ErrorCode::TenantInvitationInvalid->problem();

        if (mb_strtolower($compte->email) !== $invitation->email) {
            throw ErrorCode::TenantInvitationEmailMismatch->problem();
        }

        return $invitation;
    }

    /**
     * À appeler dans la transaction de l'appelant : le rattachement de la partie et l'acceptation réussissent ou échouent ensemble.
     */
    public function handle(string $userId, #[\SensitiveParameter] string $jeton, bool $consent): TenantInvitationData
    {
        if (! $consent) {
            throw ErrorCode::TenantInvitationConsentRequired->problem();
        }

        $invitation = $this->check($userId, $jeton);

        return $this->contexte->run($invitation->organization_id, fn (): TenantInvitationData => DB::transaction(function () use ($invitation, $userId, $jeton): TenantInvitationData {
            $verrouillee = TenantInvitation::query()->whereKey($invitation->id)->lockForUpdate()->first();

            if ($verrouillee === null
                || $verrouillee->status !== TenantInvitationStatus::Pending
                || $verrouillee->token_hash !== TenantInvitationToken::hash($jeton)
                || $verrouillee->expires_at->isPast()) {
                throw ErrorCode::TenantInvitationInvalid->problem();
            }

            $verrouillee->forceFill([
                'status' => TenantInvitationStatus::Accepted,
                'token_hash' => null,
                'accepted_by_user_id' => $userId,
                'accepted_at' => now(),
                'consent_version' => TenantInvitation::CONSENT_VERSION,
            ])->save();

            $this->audit->handle('identity.tenant_invitation.accepted', $userId, ['party_id' => $verrouillee->party_id, 'consent_version' => TenantInvitation::CONSENT_VERSION], $verrouillee);

            return $this->invitations->data($verrouillee);
        }));
    }
}
