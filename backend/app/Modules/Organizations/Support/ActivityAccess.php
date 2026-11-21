<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Enums\ActivityView;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberRole;

/**
 * Qui lit quoi dans le journal (ADR 0038, décision 4) : `owner` et `admin` tout, `manager` l'historique d'une entité sans différentiel
 * ni origine, `accountant` rien. Le middleware de route écarte déjà le comptable ; ce contrôle ferme le cas du gestionnaire sans entité.
 */
final class ActivityAccess
{
    public static function viewFor(MemberRole $role, bool $hasEntity): ActivityView
    {
        return match ($role) {
            MemberRole::Owner, MemberRole::Admin => ActivityView::Rows,
            MemberRole::Manager => $hasEntity ? ActivityView::History : throw ErrorCode::RoleForbidden->problem(),
            MemberRole::Accountant => throw ErrorCode::RoleForbidden->problem(),
        };
    }
}
