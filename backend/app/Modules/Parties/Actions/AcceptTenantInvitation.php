<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\ErrorCode as IdentityErrorCode;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class AcceptTenantInvitation
{
    public function __construct(
        private TenantInvitations $invitations,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * L'acceptation de l'invitation (adresse confirmée, consentement) et le rattachement de la partie sont une seule transaction.
     */
    public function handle(string $userId, #[\SensitiveParameter] string $jeton, bool $consent): LinkedPartyData
    {
        return DB::transaction(function () use ($userId, $jeton, $consent): LinkedPartyData {
            $invitation = $this->invitations->consume($userId, $jeton, $consent);

            return $this->contexte->run($invitation->organizationId, function () use ($invitation, $userId): LinkedPartyData {
                $partie = Party::query()->whereKey($invitation->partyId)->lockForUpdate()->first();

                if ($partie === null || $partie->isAnonymized()) {
                    throw IdentityErrorCode::TenantInvitationInvalid->problem();
                }

                if ($partie->user_id !== null && $partie->user_id !== $userId) {
                    throw ErrorCode::PartyAlreadyLinked->problem();
                }

                if (Party::query()->where('user_id', $userId)->whereKeyNot($partie->id)->exists()) {
                    throw ErrorCode::AccountAlreadyLinked->problem();
                }

                $partie->forceFill(['user_id' => $userId])->save();
                $this->audit->handle('parties.tenant_access.linked', $userId, ['invitation_id' => $invitation->id], $partie);

                return new LinkedPartyData($partie->organization_id, $partie->id);
            });
        });
    }
}
