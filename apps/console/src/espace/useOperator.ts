'use client';

import { usePlatformQuery } from '@/platform/context';
import type { PlatformQuery } from '@/platform/context';
import type { OperatorMe } from '@/platform/me/me';
import type { OperatorRole } from '@/platform/roles';
import { canAccess } from '@/platform/roles';

const NO_ROLES: readonly OperatorRole[] = [];

export function useOperator(): PlatformQuery<OperatorMe> {
  return usePlatformQuery(['me'], (api) => api.me());
}

export interface NavigationInputs {
  roles: readonly OperatorRole[] | undefined;
  pendingApprovals: number | undefined;
}

/** Tant que le profil charge, aucune entrée réservée n'est proposée ; en cas d'échec, le serveur reste seul juge. */
export function useNavigationInputs(): NavigationInputs {
  const operator = useOperator();
  const roles = operator.isError ? undefined : (operator.data?.roles ?? NO_ROLES);
  const approvals = usePlatformQuery(
    ['approvals', 'pending-count'],
    (api) => api.approvals.list({ status: 'pending', perPage: 1 }),
    { enabled: roles !== undefined && canAccess(roles, 'approbations') },
  );
  return { roles, pendingApprovals: approvals.data?.pendingCount };
}

export function useNoNavigationInputs(): NavigationInputs {
  return { roles: undefined, pendingApprovals: undefined };
}
