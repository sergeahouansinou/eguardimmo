<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\IssuedOwnerInvitationData;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Identity\Queries\OwnerInvitations;
use App\Modules\Identity\Support\InvitationDailyLimit;
use App\Modules\Identity\Support\OwnerInvitationCode;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class IssueOwnerInvitation
{
    public function __construct(
        private OwnerInvitations $invitations,
        private RecordAudit $audit,
    ) {}

    /**
     * Suppose un contexte d'organisation et un appelant qui a vérifié le mandant et son rôle. Une invitation en attente
     * pour le même mandant et la même adresse est remplacée.
     */
    public function handle(string $mandantPartyId, ?string $personPartyId, OwnerAccessRole $role, string $organizationName, string $email, string $inviterUserId, bool $powersAttested): IssuedOwnerInvitationData
    {
        $email = mb_strtolower(trim($email));
        $jeton = TenantInvitationToken::generate();
        $code = OwnerInvitationCode::generate();
        $jours = $this->jours();

        $invitation = DB::transaction(function () use ($mandantPartyId, $personPartyId, $role, $organizationName, $email, $inviterUserId, $powersAttested, $jeton, $code, $jours): OwnerInvitation {
            InvitationDailyLimit::assertBelow(InvitationDailyLimit::OWNER, OwnerInvitation::query()->where('created_at', '>=', now()->subDay())->count());

            $ancienne = OwnerInvitation::query()
                ->where('mandant_party_id', $mandantPartyId)
                ->where('email', $email)
                ->where('status', OwnerInvitationStatus::Pending)
                ->lockForUpdate()
                ->first();

            $ancienne?->forceFill([
                ...$ancienne->endedAttributes(OwnerInvitationStatus::Revoked),
                'revoked_at' => now(),
                'revoked_by' => OwnerRevoker::Organization,
                'revoked_by_user_id' => $inviterUserId,
            ])->save();

            if ($ancienne !== null) {
                $this->audit->handle('identity.owner_invitation.revoked', $inviterUserId, ['mandant_party_id' => $mandantPartyId, 'by' => OwnerRevoker::Organization->value, 'replaced' => true], $ancienne);
            }

            $invitation = new OwnerInvitation([
                'mandant_party_id' => $mandantPartyId,
                'person_party_id' => $personPartyId,
                'role' => $role,
                'organization_name' => $organizationName,
                'email' => $email,
                'token_hash' => TenantInvitationToken::hash($jeton),
                'code_attempts' => 0,
                'status' => OwnerInvitationStatus::Pending,
                'expires_at' => now()->addDays($jours),
                'invited_by_user_id' => $inviterUserId,
                'identity_attested_at' => now(),
                'powers_attested' => $powersAttested,
            ]);
            $invitation->id = $invitation->newUniqueId();
            $invitation->code_hash = OwnerInvitationCode::hash($invitation->id, $code);
            $invitation->save();

            $this->audit->handle('identity.owner_invitation.issued', $inviterUserId, ['mandant_party_id' => $mandantPartyId, 'role' => $role->value, 'powers_attested' => $powersAttested], $invitation);

            return $invitation;
        });

        Notification::route('mail', $email)->notify(new OwnerInvitationNotification($organizationName, TenantInvitationToken::ownerUrl($jeton), $jours));

        return new IssuedOwnerInvitationData($this->invitations->data($invitation), $code);
    }

    private function jours(): int
    {
        $jours = config('identity.owner_invitation_days');

        return is_int($jours) && $jours > 0 ? $jours : 7;
    }
}
