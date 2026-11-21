'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeeQuery, HoldQuery, PayoutRequestQuery } from './model';
import { useOwnerFundsSource } from './source';

export const OWNER_FUNDS_ROOT = ['gestion', 'owner-funds'] as const;
const PARTY_ROOT = ['gestion', 'owner-funds-parties'] as const;

export const ownerFundsKeys = {
  preview: (limit?: number) => [...OWNER_FUNDS_ROOT, 'preview', limit ?? null] as const,
  account: (mandantId: string) => [...OWNER_FUNDS_ROOT, 'account', mandantId] as const,
  batches: (cursor: string | null) => [...OWNER_FUNDS_ROOT, 'batches', cursor] as const,
  batch: (id: string) => [...OWNER_FUNDS_ROOT, 'batch', id] as const,
  holds: (query: HoldQuery) => [...OWNER_FUNDS_ROOT, 'holds', query] as const,
  fees: (query: FeeQuery) => [...OWNER_FUNDS_ROOT, 'fees', query] as const,
  coverage: () => [...OWNER_FUNDS_ROOT, 'coverage'] as const,
  deposits: (cursor: string | null) => [...OWNER_FUNDS_ROOT, 'deposits', cursor] as const,
  periods: () => [...OWNER_FUNDS_ROOT, 'periods'] as const,
  requests: (query: PayoutRequestQuery) => [...OWNER_FUNDS_ROOT, 'payout-requests', query] as const,
  party: (id: string) => [...PARTY_ROOT, id] as const,
};

export interface OwnerFundsQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useOwnerFundsQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): OwnerFundsQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false, gcTime: 0, staleTime: 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useOwnerFundsPermissions = () => useOwnerFundsSource().permissions;

export function usePayoutPreview(limit?: number) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.preview(limit), () => source.preview(limit));
}

export function useMandantAccount(mandantId: string) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.account(mandantId), () => source.mandantAccount(mandantId));
}

export function useBatches(cursor: string | null) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.batches(cursor), () => source.batches(cursor));
}

export function useBatch(id: string) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.batch(id), () => source.batch(id));
}

export function useHolds(query: HoldQuery) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.holds(query), () => source.holds(query));
}

export function useFees(query: FeeQuery) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.fees(query), () => source.fees(query));
}

export function useCoverage() {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.coverage(), () => source.coverage());
}

export function useDeposits(cursor: string | null) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.deposits(cursor), () => source.deposits(cursor));
}

export function usePeriods() {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.periods(), () => source.periods());
}

export function usePayoutRequests(query: PayoutRequestQuery) {
  const source = useOwnerFundsSource();
  return useOwnerFundsQuery(ownerFundsKeys.requests(query), () => source.payoutRequests(query));
}

export type PartyNames = (id: string) => string;

export function usePartyNames(ids: readonly string[]): PartyNames {
  const source = useOwnerFundsSource();
  const unique = [...new Set(ids)];
  const results = useQueries({
    queries: unique.map((id) => ({ queryKey: ownerFundsKeys.party(id), queryFn: () => source.partyName(id), retry: false, staleTime: 300_000 })),
  });
  const names = new Map<string, string>();
  unique.forEach((id, index) => {
    const name = results[index]?.data;
    if (typeof name === 'string') names.set(id, name);
  });
  return (id) => names.get(id) ?? 'Mandant';
}

function useOwnerFundsMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: OWNER_FUNDS_ROOT }),
  });
}

export function useCreateBatch() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ mandantIds, key }: { mandantIds: readonly string[] | null; key: string }) => source.createBatch(mandantIds, key));
}

export function useToggleItem() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, itemId, lockVersion, include, key }: { batchId: string; itemId: string; lockVersion: number; include: boolean; key: string }) =>
    include ? source.includeItem(batchId, itemId, lockVersion, key) : source.excludeItem(batchId, itemId, lockVersion, key),
  );
}

export function usePlaceHold() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ input, key }: { input: Parameters<typeof source.placeHold>[0]; key: string }) => source.placeHold(input, key));
}

export function useReleaseHold() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ holdId, key }: { holdId: string; key: string }) => source.releaseHold(holdId, key));
}

export function useValidateBatch() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, lockVersion, key }: { batchId: string; lockVersion: number; key: string }) => source.validateBatch(batchId, lockVersion, key));
}

export function useCancelBatch() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, reason, lockVersion, key }: { batchId: string; reason: string; lockVersion: number; key: string }) => source.cancelBatch(batchId, reason, lockVersion, key));
}

export function useExecuteItem() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, itemId, input, key }: { batchId: string; itemId: string; input: Parameters<typeof source.executeItem>[2]; key: string }) => source.executeItem(batchId, itemId, input, key));
}

export function useFailItem() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, itemId, reason, key }: { batchId: string; itemId: string; reason: string; key: string }) => source.failItem(batchId, itemId, reason, key));
}

export function useReturnItem() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ batchId, itemId, reason, key }: { batchId: string; itemId: string; reason: string; key: string }) => source.returnItem(batchId, itemId, reason, key));
}

export function useWithdrawFees() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ input, key }: { input: Parameters<typeof source.withdrawFees>[0]; key: string }) => source.withdrawFees(input, key));
}

export function useRequestDeposit() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ input, key }: { input: Parameters<typeof source.requestDeposit>[0]; key: string }) => source.requestDeposit(input, key));
}

export function useConfirmDeposit() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ depositId, key }: { depositId: string; key: string }) => source.confirmDeposit(depositId, key));
}

export function useCloseMonth() {
  const source = useOwnerFundsSource();
  return useOwnerFundsMutation(({ month, key }: { month: string; key: string }) => source.closeMonth(month, key));
}

export function useExportBatch() {
  const source = useOwnerFundsSource();
  return useMutation({ mutationFn: (batchId: string) => source.exportBatch(batchId) });
}
