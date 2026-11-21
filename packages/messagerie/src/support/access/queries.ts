'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { POLL, pollEvery } from '../../external/polling';
import { isStaleAccessFailure } from './api/errors';
import { useOptionalSupportAccessConfig, useSupportAccessConfig } from './context';
import { isEmergencyOpen } from './model';
import type { AcceptAccessInput, AccessGrant, AccessStatus } from './model';

export const accessKeys = {
  all: ['support-access'] as const,
  list: (status: AccessStatus | null) => ['support-access', 'list', status] as const,
  summary: ['support-access', 'summary'] as const,
};

export interface AccessSummary {
  pending: number;
  emergencies: AccessGrant[];
}

export function useAccessList(status: AccessStatus | null) {
  const { source } = useSupportAccessConfig();
  return useInfiniteQuery({
    queryKey: accessKeys.list(status),
    queryFn: ({ pageParam }) => source.list(status, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    refetchInterval: pollEvery(POLL.inbox),
    retry: false,
    staleTime: 0,
  });
}

export function useAccessSummary(): AccessSummary | undefined {
  const config = useOptionalSupportAccessConfig();
  const source = config?.source;
  return useQuery({
    queryKey: accessKeys.summary,
    enabled: config?.canManage === true,
    queryFn: async (): Promise<AccessSummary> => {
      if (source === undefined) return { pending: 0, emergencies: [] };
      const [requested, active] = await Promise.all([source.list('requested', null), source.list('active', null)]);
      return { pending: requested.items.length, emergencies: active.items.filter(isEmergencyOpen) };
    },
    refetchInterval: pollEvery(POLL.unread),
    retry: false,
    staleTime: 0,
  }).data;
}

function useRefreshAccess() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: accessKeys.all });
  return { onSuccess: refresh, onError: (error: unknown) => (isStaleAccessFailure(error) ? refresh() : undefined) };
}

export function useAcceptAccess() {
  const { source } = useSupportAccessConfig();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AcceptAccessInput }) => source.accept(id, input),
    ...refresh,
  });
}

export function useRefuseAccess() {
  const { source } = useSupportAccessConfig();
  const refresh = useRefreshAccess();
  return useMutation({ mutationFn: (id: string) => source.refuse(id), ...refresh });
}

export function useRevokeAccess() {
  const { source } = useSupportAccessConfig();
  const refresh = useRefreshAccess();
  return useMutation({ mutationFn: (id: string) => source.revoke(id), ...refresh });
}
