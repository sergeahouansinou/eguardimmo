<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\TenantInvitationData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Notifications\TenantInvitationNotification;
use App\Modules\Identity\Queries\TenantInvitations;
use App\Modules\Identity\Support\InvitationDailyLimit;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class IssueTenantInvitation
{
    public function __construct(
        private TenantInvitations $invitations,
        private RecordAudit $audit,
    ) {}

    /**
     * Suppose un contexte d'organisation. Une invitation en attente est remplacée ; une partie déjà rattachée refuse.
     */
    public function handle(string $partyId, string $organizationName, string $email, string $inviterUserId): TenantInvitationData
    {
        $email = mb_strtolower(trim($email));
        $jeton = TenantInvitationToken::generate();

        $invitation = DB::transaction(function () use ($partyId, $organizationName, $email, $inviterUserId, $jeton): TenantInvitation {
            InvitationDailyLimit::assertBelow(InvitationDailyLimit::TENANT, TenantInvitation::query()->where('created_at', '>=', now()->subDay())->count());

            $actuelle = TenantInvitation::query()
                ->where('party_id', $partyId)
                ->whereIn('status', [TenantInvitationStatus::Pending, TenantInvitationStatus::Accepted])
                ->lockForUpdate()
                ->first();

            if ($actuelle?->status === TenantInvitationStatus::Accepted) {
                throw ErrorCode::TenantAccessAlreadyGranted->problem();
            }

            $actuelle?->forceFill([
                'status' => TenantInvitationStatus::Revoked,
                'token_hash' => null,
                'revoked_at' => now(),
                'revoked_by' => TenantRevoker::Organization,
                'revoked_by_user_id' => $inviterUserId,
            ])->save();

            $invitation = TenantInvitation::query()->create([
                'party_id' => $partyId,
                'organization_name' => $organizationName,
                'email' => $email,
                'token_hash' => TenantInvitationToken::hash($jeton),
                'status' => TenantInvitationStatus::Pending,
                'expires_at' => now()->addDays(TenantInvitationToken::VALIDITE_JOURS),
                'invited_by_user_id' => $inviterUserId,
            ]);

            $this->audit->handle('identity.tenant_invitation.issued', $inviterUserId, ['party_id' => $partyId], $invitation);

            return $invitation;
        });

        Notification::route('mail', $email)->notify(new TenantInvitationNotification($organizationName, TenantInvitationToken::url($jeton)));

        return $this->invitations->data($invitation);
    }
}
