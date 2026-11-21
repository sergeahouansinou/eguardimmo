'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { isUuid } from './ids';
import type { LeaseSummary } from './model';
import { useLeases } from './queries';

export interface SelectedLease {
  leases: LeaseSummary[];
  lease: LeaseSummary | null;
  select: (leaseId: string) => void;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  hasMore: boolean;
}

export function useSelectedLease(eligible: (lease: LeaseSummary) => boolean = () => true): SelectedLease {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('bail');
  const query = useLeases();
  const leases = (query.data?.pages ?? []).flatMap((page) => page.items).filter(eligible);
  const lease = leases.find((item) => isUuid(requested) && item.id === requested) ?? leases[0] ?? null;
  const select = (leaseId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('bail', leaseId);
    router.replace(`?${next.toString()}`);
  };
  return {
    leases,
    lease,
    select,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    hasMore: query.hasNextPage,
  };
}
