'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActInput, ActQuery, CaseQuery, CaseStatus, OpenCaseInput, ReceivableIds, TransmitInput, UnpaidQuery } from './model';
import { useRecoverySource } from './source';

export const RECOVERY_ROOT = ['gestion', 'recovery'] as const;

export const recoveryKeys = {
  unpaid: (query: UnpaidQuery) => [...RECOVERY_ROOT, 'unpaid', query] as const,
  cases: (query: CaseQuery) => [...RECOVERY_ROOT, 'cases', query] as const,
  case: (id: string) => [...RECOVERY_ROOT, 'case', id] as const,
  acts: (caseId: string, query: ActQuery) => [...RECOVERY_ROOT, 'acts', caseId, query] as const,
  bundle: (id: string) => [...RECOVERY_ROOT, 'bundle', id] as const,
  bailiffs: () => [...RECOVERY_ROOT, 'bailiffs'] as const,
};

export interface RecoveryQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useRecoveryQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): RecoveryQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useRecoveryPermissions = () => useRecoverySource().permissions;

export function useUnpaid(query: UnpaidQuery) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.unpaid(query), () => source.unpaid(query));
}

export function useCases(query: CaseQuery) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.cases(query), () => source.cases(query));
}

export function useCase(id: string) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.case(id), () => source.caseDetail(id));
}

export function useActs(caseId: string, query: ActQuery) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.acts(caseId, query), () => source.acts(caseId, query));
}

export function useBundle(id: string) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.bundle(id), () => source.bundle(id));
}

export function useBailiffs(enabled: boolean) {
  const source = useRecoverySource();
  return useRecoveryQuery(recoveryKeys.bailiffs(), () => source.bailiffs(), enabled);
}

function useRecoveryMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: RECOVERY_ROOT }),
  });
}

export function useOpenCase() {
  const source = useRecoverySource();
  return useRecoveryMutation((input: OpenCaseInput) => source.openCase(input));
}

export function useAddItems() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ caseId, ids }: { caseId: string; ids: ReceivableIds }) => source.addItems(caseId, ids));
}

export function useRemoveItem() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ caseId, itemId }: { caseId: string; itemId: string }) => source.removeItem(caseId, itemId));
}

export function useChangeStatus() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ caseId, status, reason }: { caseId: string; status: CaseStatus; reason: string }) => source.changeStatus(caseId, status, reason));
}

export function useAddAct() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ caseId, input }: { caseId: string; input: ActInput }) => source.addAct(caseId, input));
}

export function useGenerateBundle() {
  const source = useRecoverySource();
  return useRecoveryMutation((caseId: string) => source.generateBundle(caseId));
}

export function useTransmit() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ bundleId, input }: { bundleId: string; input: TransmitInput }) => source.transmit(bundleId, input));
}

export function useRevoke() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ transmissionId, reason }: { transmissionId: string; reason: string }) => source.revoke(transmissionId, reason));
}

export function useResend() {
  const source = useRecoverySource();
  return useRecoveryMutation(({ transmissionId, validDays }: { transmissionId: string; validDays: number }) => source.resend(transmissionId, validDays));
}

export function useBundleDownload() {
  const source = useRecoverySource();
  return useMutation({ mutationFn: (bundleId: string) => source.downloadBundle(bundleId) });
}
