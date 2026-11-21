'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLeaseLookup } from './leaseLookup';
import type { LeaseDetailView, LeaseSummaryView } from './leaseLookup';

export const TENANT_REQUESTS_ROOT = ['gestion', 'tenant-requests'] as const;

export interface GuardedQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

export function useGuardedQuery<T>(key: readonly unknown[], load: () => Promise<T>, options: { enabled?: boolean; staleTime?: number } = {}): GuardedQuery<T> {
  const query = useQuery({ queryKey: [...TENANT_REQUESTS_ROOT, ...key], queryFn: load, enabled: options.enabled ?? true, retry: false, gcTime: options.staleTime ? undefined : 0, staleTime: options.staleTime ?? 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export function useScopedMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: TENANT_REQUESTS_ROOT }),
  });
}

export function useDownload() {
  return useMutation({ mutationFn: (load: () => Promise<Blob>) => load() });
}

const LOOKUP_STALE_MS = 60_000;

export function useLeaseDetail(leaseId: string | null) {
  const lookup = useLeaseLookup();
  return useGuardedQuery(['lease', leaseId ?? ''], () => lookup.lease(leaseId ?? ''), { enabled: leaseId !== null && leaseId !== '', staleTime: LOOKUP_STALE_MS });
}

export function useLeaseSearch(query: string) {
  const lookup = useLeaseLookup();
  return useGuardedQuery(['lease-search', query], () => lookup.search(query), { staleTime: LOOKUP_STALE_MS });
}

export interface LeaseLabels {
  pending: boolean;
  of: (leaseId: string) => LeaseDetailView | undefined;
  referenceOf: (leaseId: string) => string;
  tenantOf: (leaseId: string, partyId: string) => string;
}

export function useLeaseLabels(leaseIds: readonly string[]): LeaseLabels {
  const lookup = useLeaseLookup();
  const unique = [...new Set(leaseIds)];
  const results = useQueries({
    queries: unique.map((leaseId) => ({
      queryKey: [...TENANT_REQUESTS_ROOT, 'lease', leaseId],
      queryFn: () => lookup.lease(leaseId),
      retry: false,
      staleTime: LOOKUP_STALE_MS,
    })),
  });
  const byId = new Map<string, LeaseDetailView>();
  results.forEach((result, index) => {
    const leaseId = unique[index];
    if (leaseId !== undefined && result.data !== undefined) byId.set(leaseId, result.data);
  });
  const pending = results.some((result) => result.isPending);
  return {
    pending,
    of: (leaseId) => byId.get(leaseId),
    referenceOf: (leaseId) => byId.get(leaseId)?.reference ?? (pending ? '…' : 'Bail non listé'),
    tenantOf: (leaseId, partyId) => byId.get(leaseId)?.participants.find((participant) => participant.partyId === partyId)?.name ?? (pending ? '…' : 'Locataire non listé'),
  };
}

export type { LeaseDetailView, LeaseSummaryView };
