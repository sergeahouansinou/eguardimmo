<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Data\TenantInvitationData;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Queries\PartySummaries;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class InviteTenantAccount
{
    public function __construct(
        private TenantInvitations $invitations,
        private OrganizationDirectory $organisations,
        private PartySummaries $resumes,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * L'adresse invitée est celle qui devra être confirmée par le compte : par défaut l'e-mail principal de la partie.
     */
    public function handle(Party $party, ?string $email, string $inviterUserId): TenantInvitationData
    {
        return DB::transaction(function () use ($party, $email, $inviterUserId): TenantInvitationData {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            if ($partie->isAnonymized()) {
                throw ErrorCode::PartyAnonymized->problem();
            }

            if ($partie->archived_at !== null) {
                throw ErrorCode::TenantAccessPartyArchived->problem();
            }

            if ($partie->kind !== PartyKind::Person) {
                throw ErrorCode::TenantAccessPersonRequired->problem();
            }

            if ($partie->user_id !== null) {
                throw ErrorCode::PartyAlreadyLinked->problem();
            }

            $adresse = $email ?? $this->resumes->one($partie->id)->primaryEmail ?? throw ErrorCode::TenantAccessEmailRequired->problem();
            $nom = $this->organisations->names([$this->contexte->id()])[$this->contexte->id()] ?? '';

            return $this->invitations->issue($partie->id, $nom, $adresse, $inviterUserId);
        });
    }
}
