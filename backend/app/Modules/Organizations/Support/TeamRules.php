<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;

final class TeamRules
{
    public static function ensureAlterable(OrganizationMember $cible, OrganizationMember $auteur): void
    {
        if ($cible->role === MemberRole::Owner) {
            throw ErrorCode::OwnerImmutable->problem();
        }

        if ($cible->id === $auteur->id) {
            throw ErrorCode::SelfChangeForbidden->problem();
        }

        if (self::estDernierAdministrateur($cible)) {
            throw ErrorCode::LastAdministrator->problem();
        }
    }

    private static function estDernierAdministrateur(OrganizationMember $cible): bool
    {
        if ($cible->role !== MemberRole::Admin || $cible->status !== MemberStatus::Active) {
            return false;
        }

        return ! OrganizationMember::query()
            ->whereKeyNot($cible->id)
            ->where('status', MemberStatus::Active)
            ->whereIn('role', [MemberRole::Owner, MemberRole::Admin])
            ->lockForUpdate()
            ->exists();
    }
}
