<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Seuls `owner` et `admin` de l'organisation courante voient et décident des accès du support (ADR 0033, décision 9).
 */
final readonly class SupportAccessAdministrators
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $organisation,
    ) {}

    public function assert(User $user): void
    {
        $adhesion = $this->adhesions->activeMembership($user->id, $this->organisation->id());

        if ($adhesion === null || ! in_array($adhesion->role, [MemberRole::Owner, MemberRole::Admin], true)) {
            throw OrganizationError::RoleForbidden->problem();
        }
    }
}
