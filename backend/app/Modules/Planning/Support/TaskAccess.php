<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Planning\Models\PlanningTask;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Terminer ou rouvrir une tâche : `owner`, `admin` et `manager` pour toute tâche ; n'importe quel membre pour celle qu'il a créée
 * ou qu'on lui a confiée (ADR 0038, décision 6).
 */
final readonly class TaskAccess
{
    private const array ROLES = [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager];

    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * @return bool vrai pour owner, admin et manager : eux seuls rouvrent une tâche annulée
     */
    public function assertCanProgress(User $user, PlanningTask $task): bool
    {
        $adhesion = $this->adhesions->activeMembership($user->id, $this->organisation->id()) ?? throw OrganizationError::RoleForbidden->problem();

        $privilegie = in_array($adhesion->role, self::ROLES, true);

        if ($privilegie || $task->created_by_user_id === $user->id || $task->assignee_user_id === $user->id) {
            return $privilegie;
        }

        throw OrganizationError::RoleForbidden->problem();
    }
}
