'use client';

import { useOperator } from '@/espace/useOperator';
import { usePlatformQuery } from '@/platform/context';
import type { Approval } from '@/platform/approvals/approvals';
import type { OrganisationQuery } from '@/platform/organisations/organisations';
import type { SupportAccessQuery } from '@/platform/organisations/supportAccesses';
import { canAccess } from '@/platform/roles';
import type { OperatorRole } from '@/platform/roles';

export const useOrganisations = (query: OrganisationQuery) =>
  usePlatformQuery(['organisations', 'list', query], (api) => api.organisations.list(query), { keepPrevious: true });

export const useOrganisation = (id: string) => usePlatformQuery(['organisations', 'detail', id], (api) => api.organisations.get(id));

export const useEntitlements = (id: string) => usePlatformQuery(['organisations', 'entitlements', id], (api) => api.subscriptions.organisationEntitlements(id));

export const useSupportAccesses = (id: string, query: SupportAccessQuery) =>
  usePlatformQuery(['organisations', 'support-accesses', id, query], (api) => api.supportAccesses.list(id, query), { keepPrevious: true });

const NO_ROLES: readonly OperatorRole[] = [];

export function useRoles(): readonly OperatorRole[] {
  return useOperator().data?.roles ?? NO_ROLES;
}

export function usePendingApprovals(): readonly Approval[] {
  const operator = useOperator();
  const allowed = operator.data !== undefined && canAccess(operator.data.roles, 'approbations');
  const pending = usePlatformQuery(['approvals', 'pending-window'], (api) => api.approvals.list({ status: 'pending', perPage: 100 }), { enabled: allowed });
  return pending.data?.rows ?? [];
}
