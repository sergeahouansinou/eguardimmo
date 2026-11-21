<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Qui, dans l'organisation courante, parle aux locataires et aux mandants : `owner`, `admin` et `manager` (ADR 0033, décision 12).
 * Le comptable en est exclu. Les fils mandant n'existent que pour une agence.
 */
final readonly class StaffAccess
{
    public const array ROLES = [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager];

    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $organisation,
    ) {}

    public function assertExternal(User $user, ConversationKind $kind): MembershipData
    {
        $adhesion = $this->adhesions->activeMembership($user->id, $this->organisation->id()) ?? throw ErrorCode::ConversationNotFound->problem();

        if (! in_array($adhesion->role, self::ROLES, true)) {
            throw OrganizationError::RoleForbidden->problem();
        }

        if ($kind === ConversationKind::Owner && $adhesion->kind !== OrganizationKind::Agency) {
            throw ErrorCode::ConversationKindUnavailable->problem();
        }

        return $adhesion;
    }

    public function assertAdministrator(User $user, ConversationKind $kind): MembershipData
    {
        $adhesion = $this->assertExternal($user, $kind);

        if (! $this->canAdminister($adhesion)) {
            throw OrganizationError::RoleForbidden->problem();
        }

        return $adhesion;
    }

    public function canReadExternal(User $user, ConversationKind $kind): bool
    {
        try {
            $this->assertExternal($user, $kind);
        } catch (ApiProblem) {
            return false;
        }

        return true;
    }

    public function canAdminister(MembershipData $adhesion): bool
    {
        return in_array($adhesion->role, [MemberRole::Owner, MemberRole::Admin], true);
    }
}
