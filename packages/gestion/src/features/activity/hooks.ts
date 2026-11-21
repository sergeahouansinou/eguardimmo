'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgInfoSource } from '../orgapi/source';
import { ORG_ROOT, useOrgQuery } from '../orgapi/hooks';
import type { ActivityFilters, ActivityQuery } from './model';
import { useActivitySource } from './source';

export const ACTIVITY_ROOT = ['gestion', 'activity'] as const;

export const activityKeys = {
  list: (organizationId: string | null, query: ActivityQuery) => [...ACTIVITY_ROOT, 'list', organizationId, query] as const,
  detail: (organizationId: string | null, id: string) => [...ACTIVITY_ROOT, 'detail', organizationId, id] as const,
};

export function useActivityEntries(query: ActivityQuery, enabled = true) {
  const source = useActivitySource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery(activityKeys.list(organizationId, query), () => source.list(query), { enabled });
}

export function useActivityDetail(id: string | null) {
  const source = useActivitySource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery(activityKeys.detail(organizationId, id ?? ''), () => source.detail(id ?? ''), { enabled: id !== null });
}

export function useExportActivity() {
  const source = useActivitySource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (filters: ActivityFilters) => source.exportCsv(filters),
    onSettled: () => client.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
  });
}

export function useActivityRetry(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ACTIVITY_ROOT });
    void client.invalidateQueries({ queryKey: ORG_ROOT });
  };
}
