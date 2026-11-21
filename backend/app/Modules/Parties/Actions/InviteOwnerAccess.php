<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Data\IssuedOwnerInvitationData;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Notifications\OwnerLinkAlertNotification;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Modules\Parties\Queries\PartySummaries;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

final readonly class InviteOwnerAccess
{
    public function __construct(
        private OwnerInvitations $invitations,
        private OwnerAccesses $acces,
        private OrganizationDirectory $organisations,
        private PartySummaries $resumes,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Suppose un contexte d'organisation. L'agence atteste l'identité du mandant (et les pouvoirs d'un représentant) ; l'adresse
     * invitée est celle de la personne, à défaut celle du mandant. Les accès vivants et les invitations en attente comptent dans le plafond.
     */
    public function handle(Party $mandant, OwnerAccessRole $role, ?string $personPartyId, ?string $email, bool $identityVerified, bool $powersVerified, string $inviterUserId): IssuedOwnerInvitationData
    {
        if (! $identityVerified || ($role === OwnerAccessRole::Representative && ! $powersVerified)) {
            throw ErrorCode::OwnerIdentityAttestationRequired->problem();
        }

        return DB::transaction(function () use ($mandant, $role, $personPartyId, $email, $inviterUserId, $powersVerified): IssuedOwnerInvitationData {
            $partie = Party::query()->whereKey($mandant->id)->lockForUpdate()->firstOrFail();

            if ($partie->isAnonymized()) {
                throw ErrorCode::PartyAnonymized->problem();
            }

            if ($partie->archived_at !== null) {
                throw ErrorCode::OwnerAccessPartyArchived->problem();
            }

            $personne = $this->personne($partie, $role, $personPartyId);
            $adresse = mb_strtolower($email ?? $this->resumes->one(($personne ?? $partie)->id)->primaryEmail ?? throw ErrorCode::OwnerAccessEmailRequired->problem());

            if ($this->estCelleDeLEquipe($adresse, $inviterUserId)) {
                throw ErrorCode::OwnerAccessEmailForbidden->problem();
            }

            if ($this->acces->countActiveOfMandant($partie->id) + $this->invitations->countPending($partie->id, $adresse) >= $this->plafond()) {
                throw ErrorCode::OwnerAccessLimitReached->problem();
            }

            $nom = $this->organisations->names([$this->contexte->id()])[$this->contexte->id()] ?? '';

            $emise = $this->invitations->issue($partie->id, $personne?->id, $role, $nom, $adresse, $inviterUserId, $powersVerified);

            $principale = $this->resumes->one($partie->id)->primaryEmail;

            if ($principale !== null && mb_strtolower($principale) !== $adresse) {
                Notification::route('mail', $principale)->notify(new OwnerLinkAlertNotification($nom, OwnerLinkAlertNotification::INVITED));
            }

            return $emise;
        });
    }

    private function estCelleDeLEquipe(string $adresse, string $inviterUserId): bool
    {
        $invitant = User::query()->find($inviterUserId);

        return ($invitant !== null && mb_strtolower($invitant->email) === $adresse) || $this->organisations->hasMemberAddress($adresse);
    }

    private function personne(Party $mandant, OwnerAccessRole $role, ?string $personPartyId): ?Party
    {
        $roleValide = match ($role) {
            OwnerAccessRole::Holder => $mandant->kind === PartyKind::Person && $personPartyId === null,
            OwnerAccessRole::Representative => $mandant->kind === PartyKind::Company,
            OwnerAccessRole::CoOwner => $personPartyId !== null && $personPartyId !== $mandant->id,
        };

        if (! $roleValide) {
            throw ErrorCode::OwnerAccessRoleInvalid->problem();
        }

        if ($personPartyId === null) {
            return null;
        }

        $personne = Str::isUuid($personPartyId) ? Party::query()->find($personPartyId) : null;

        if ($personne === null || $personne->kind !== PartyKind::Person || $personne->isAnonymized() || $personne->archived_at !== null) {
            throw ErrorCode::PartyNotFound->problem();
        }

        return $personne;
    }

    private function plafond(): int
    {
        $max = config('parties.owner_access_max_per_mandant');

        return is_int($max) && $max > 0 ? $max : 5;
    }
}
