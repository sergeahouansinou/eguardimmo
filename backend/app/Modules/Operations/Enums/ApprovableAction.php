<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

use App\Modules\Identity\Enums\OperatorRole;

/**
 * Liste fermée des actions à double validation (ADR 0037, décision 4) ; le code fixe qui demande et qui valide.
 */
enum ApprovableAction: string
{
    case OrganizationSuspend = 'organizations.suspend';
    case OrganizationReactivate = 'organizations.reactivate';
    case AccountReactivate = 'identity.account.reactivate';
    case AccountResetTwoFactor = 'identity.account.reset_two_factor';
    case PlanVersionPublish = 'subscriptions.plan_version.publish';
    case OverrideGrant = 'subscriptions.override.grant';
    case OverrideRevoke = 'subscriptions.override.revoke';
    case ErasureExecute = 'privacy.erasure.execute';

    /**
     * @return list<OperatorRole>
     */
    public function requesterRoles(): array
    {
        return match ($this) {
            self::OrganizationSuspend, self::OrganizationReactivate, self::AccountReactivate, self::AccountResetTwoFactor => [OperatorRole::Admin, OperatorRole::Support],
            self::PlanVersionPublish, self::OverrideGrant, self::OverrideRevoke => [OperatorRole::Billing],
            self::ErasureExecute => [OperatorRole::Compliance],
        };
    }

    /**
     * @return list<OperatorRole>
     */
    public function approverRoles(): array
    {
        return match ($this) {
            self::OrganizationSuspend, self::OrganizationReactivate, self::AccountReactivate, self::AccountResetTwoFactor => [OperatorRole::Admin, OperatorRole::Compliance],
            self::PlanVersionPublish, self::OverrideGrant, self::OverrideRevoke => [OperatorRole::Admin, OperatorRole::Billing],
            self::ErasureExecute => [OperatorRole::Compliance],
        };
    }

    /**
     * L'administrateur lit toutes les demandes ; un autre rôle ne lit que celles qu'il peut demander ou valider.
     *
     * @param  list<OperatorRole>  $roles
     */
    public function isVisibleTo(array $roles): bool
    {
        if (in_array(OperatorRole::Admin, $roles, true)) {
            return true;
        }

        return array_filter($roles, fn (OperatorRole $role): bool => in_array($role, $this->requesterRoles(), true) || in_array($role, $this->approverRoles(), true)) !== [];
    }

    /**
     * @param  list<OperatorRole>  $roles
     */
    public function canBeRequestedBy(array $roles): bool
    {
        return array_filter($roles, fn (OperatorRole $role): bool => in_array($role, $this->requesterRoles(), true)) !== [];
    }

    /**
     * @param  list<OperatorRole>  $roles
     */
    public function canBeDecidedBy(array $roles): bool
    {
        return array_filter($roles, fn (OperatorRole $role): bool => in_array($role, $this->approverRoles(), true)) !== [];
    }

    /**
     * @param  list<OperatorRole>  $roles
     * @return list<self>
     */
    public static function visibleTo(array $roles): array
    {
        return array_values(array_filter(self::cases(), fn (self $action): bool => $action->isVisibleTo($roles)));
    }
}
