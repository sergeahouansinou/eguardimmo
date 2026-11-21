<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Identity\Enums\ErrorCode as IdentityErrorCode;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\TwoFactorProofs;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class Operators
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $contexte,
        private TwoFactorProofs $preuves,
    ) {}

    public function userId(): ?string
    {
        $id = auth()->id();

        return is_string($id) ? $id : null;
    }

    public function isIndividualOrganization(): bool
    {
        $utilisateur = $this->userId();

        return $utilisateur !== null && $this->adhesions->activeMembership($utilisateur, $this->contexte->id())?->kind === OrganizationKind::Individual;
    }

    public function role(): ?MemberRole
    {
        $utilisateur = $this->userId();

        return $utilisateur === null ? null : $this->adhesions->activeMembership($utilisateur, $this->contexte->id())?->role;
    }

    /**
     * @param  list<MemberRole>  $roles
     */
    public function assertRole(array $roles): void
    {
        if (! in_array($this->role(), $roles, true)) {
            throw ErrorCode::RoleForbidden->problem();
        }
    }

    public function assertTwoFactor(): void
    {
        $utilisateur = auth()->user();

        if (! $utilisateur instanceof User || ! $utilisateur->hasConfirmedTwoFactor()) {
            throw ErrorCode::TwoFactorRequired->problem();
        }
    }

    /**
     * Preuve de double authentification de la session datant de moins de dix minutes, pour une saisie qu'aucun middleware de route ne peut cibler.
     */
    public function assertRecentTwoFactor(): void
    {
        if ($this->preuves->recent(request()) === null) {
            throw IdentityErrorCode::ReauthenticationRequired->problem();
        }
    }
}
