'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery } from '@tanstack/react-query';
import { OWNER_FUNDS_ROOT } from '../hooks';
import { useOwnerFundsSource } from '../source';

const MANDATES_KEY = [...OWNER_FUNDS_ROOT, 'fee-mandates'] as const;

export function useFeeMandates() {
  const source = useOwnerFundsSource();
  const query = useQuery({ queryKey: MANDATES_KEY, queryFn: () => source.feeMandates(), retry: false, gcTime: 0, staleTime: 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null, retry: () => void query.refetch() };
}

export function useSimulateFees() {
  const source = useOwnerFundsSource();
  return useMutation({ mutationFn: (proposal: Parameters<typeof source.simulateFees>[0]) => source.simulateFees(proposal) });
}
