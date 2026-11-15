<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Queries\Memberships;
use App\Modules\Organizations\Support\InvitationToken;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class AcceptInvitation
{
    public function __construct(
        private Memberships $adhesions,
        private CurrentOrganization $contexte,
    ) {}

    public function handle(User $user, #[\SensitiveParameter] string $jeton): OrganizationMember
    {
        $invitation = $this->adhesions->pendingInvitation(InvitationToken::hash($jeton))
            ?? throw ErrorCode::InvitationInvalid->problem();

        if (mb_strtolower($user->email) !== $invitation->email) {
            throw ErrorCode::InvitationEmailMismatch->problem();
        }

        return $this->contexte->run($invitation->organization_id, fn (): OrganizationMember => DB::transaction(function () use ($invitation, $user): OrganizationMember {
            $membre = OrganizationMember::query()->whereKey($invitation->id)->lockForUpdate()->first();

            if ($membre === null || $membre->status !== MemberStatus::Invited || $membre->invitation_token_hash !== $invitation->invitation_token_hash) {
                throw ErrorCode::InvitationInvalid->problem();
            }

            if (OrganizationMember::query()->where('user_id', $user->id)->exists()) {
                throw ErrorCode::AlreadyMember->problem();
            }

            $membre->forceFill([
                'user_id' => $user->id,
                'status' => MemberStatus::Active,
                'joined_at' => now(),
                'invitation_token_hash' => null,
                'invitation_expires_at' => null,
            ])->save();

            return $membre;
        }));
    }
}
