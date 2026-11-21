'use client';

import { useOperator } from '@/espace/useOperator';
import { usePlatformQuery } from '@/platform/context';
import type { Approval } from '@/platform/approvals/approvals';
import { canAccess } from '@/platform/roles';

const PENDING_WINDOW = 100;

/** Demande vivante portant sur ce sujet, lue dans la file des demandes en attente (les rôles sans accès aux approbations n'en voient pas). */
export function usePendingApproval(subjectId: string, actions: readonly string[]): Approval | null {
  const operator = useOperator();
  const allowed = operator.data !== undefined && canAccess(operator.data.roles, 'approbations');
  const pending = usePlatformQuery(['approvals', 'pending-window'], (api) => api.approvals.list({ status: 'pending', perPage: PENDING_WINDOW }), { enabled: allowed });
  return pending.data?.rows.find((row) => row.subjectId === subjectId && actions.includes(row.action)) ?? null;
}
