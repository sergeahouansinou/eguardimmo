'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountInput, BookLineQuery, BuildReconciliationInput, CsvProfile, IgnoreReason, ImportFormat, LineQuery, SettleInput } from './model';
import { useBankingSource } from './source';

export const BANKING_ROOT = ['gestion', 'banking'] as const;

export const bankingKeys = {
  accounts: () => [...BANKING_ROOT, 'accounts'] as const,
  currency: () => [...BANKING_ROOT, 'currency'] as const,
  statements: (accountId: string | null, cursor: string | null) => [...BANKING_ROOT, 'statements', accountId, cursor] as const,
  statement: (id: string) => [...BANKING_ROOT, 'statement', id] as const,
  lines: (query: LineQuery) => [...BANKING_ROOT, 'lines', query] as const,
  bookLines: (query: BookLineQuery) => [...BANKING_ROOT, 'book-lines', query] as const,
  reconciliations: (accountId: string | null, cursor: string | null) => [...BANKING_ROOT, 'reconciliations', accountId, cursor] as const,
  reconciliation: (id: string) => [...BANKING_ROOT, 'reconciliation', id] as const,
};

export interface BankingQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

interface QueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

function useBankingQuery<T>(key: readonly unknown[], load: () => Promise<T>, options: QueryOptions = {}): BankingQuery<T> {
  const query = useQuery({
    queryKey: key,
    queryFn: load,
    enabled: options.enabled ?? true,
    retry: false,
    gcTime: options.staleTime ? undefined : 0,
    staleTime: options.staleTime ?? 0,
    refetchInterval: options.refetchInterval ?? false,
  });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useBankingPermissions = () => useBankingSource().permissions;

const CHOICE_STALE_MS = 60_000;

export function useAccounts() {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.accounts(), () => source.accounts(), { staleTime: CHOICE_STALE_MS });
}

export function useBankingCurrency() {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.currency(), () => source.currency(), { staleTime: CHOICE_STALE_MS });
}

export function useStatements(accountId: string | null, cursor: string | null) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.statements(accountId, cursor), () => source.statements(accountId, cursor));
}

export function useStatement(id: string) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.statement(id), () => source.statement(id));
}

export function useLines(query: LineQuery, options: { enabled?: boolean; pollMs?: number | false } = {}) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.lines(query), () => source.lines(query), { enabled: options.enabled ?? true, refetchInterval: options.pollMs ?? false });
}

export function useBookLines(query: BookLineQuery, enabled = true) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.bookLines(query), () => source.bookLines(query), { enabled });
}

export function useReconciliations(accountId: string | null, cursor: string | null) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.reconciliations(accountId, cursor), () => source.reconciliations(accountId, cursor));
}

export function useReconciliation(id: string) {
  const source = useBankingSource();
  return useBankingQuery(bankingKeys.reconciliation(id), () => source.reconciliation(id));
}

function useBankingMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: BANKING_ROOT }),
  });
}

export function useCreateAccount() {
  const source = useBankingSource();
  return useBankingMutation(({ input, key }: { input: AccountInput; key: string }) => source.createAccount(input, key));
}

export function useReplaceAccount() {
  const source = useBankingSource();
  return useBankingMutation(({ id, input, key }: { id: string; input: AccountInput; key: string }) => source.replaceAccount(id, input, key));
}

export function useUpdateAccount() {
  const source = useBankingSource();
  return useBankingMutation(({ id, label, profile }: { id: string; label: string; profile: CsvProfile | null }) => source.updateAccount(id, label, profile));
}

export function useCloseAccount() {
  const source = useBankingSource();
  return useBankingMutation((id: string) => source.closeAccount(id));
}

export function usePreviewStatement() {
  const source = useBankingSource();
  return useMutation({ mutationFn: ({ accountId, file, format, profile }: { accountId: string; file: File; format: ImportFormat; profile: CsvProfile | null }) => source.previewStatement(accountId, file, format, profile) });
}

export function useImportStatement() {
  const source = useBankingSource();
  return useBankingMutation(({ accountId, file, format, profile, key }: { accountId: string; file: File; format: ImportFormat; profile: CsvProfile | null; key: string }) =>
    source.importStatement(accountId, file, format, profile, key),
  );
}

export function useVoidStatement() {
  const source = useBankingSource();
  return useBankingMutation(({ id, reason }: { id: string; reason: string }) => source.voidStatement(id, reason));
}

export function useMatchLine() {
  const source = useBankingSource();
  return useBankingMutation(({ lineId, otherLineIds, journalLineIds, lockVersion, key }: { lineId: string; otherLineIds: readonly string[]; journalLineIds: readonly string[]; lockVersion: number; key: string }) =>
    source.matchLine(lineId, otherLineIds, journalLineIds, lockVersion, key),
  );
}

export function useSettleLine() {
  const source = useBankingSource();
  return useBankingMutation(({ lineId, input, lockVersion, key }: { lineId: string; input: SettleInput; lockVersion: number; key: string }) => source.settleLine(lineId, input, lockVersion, key));
}

export function useIgnoreLine() {
  const source = useBankingSource();
  return useBankingMutation(({ lineId, reason, pairLineId, lockVersion }: { lineId: string; reason: IgnoreReason; pairLineId: string | null; lockVersion: number }) =>
    source.ignoreLine(lineId, reason, pairLineId, lockVersion),
  );
}

export function useRestoreLine() {
  const source = useBankingSource();
  return useBankingMutation(({ lineId, lockVersion }: { lineId: string; lockVersion: number }) => source.restoreLine(lineId, lockVersion));
}

export function useAcceptSuggestions() {
  const source = useBankingSource();
  return useBankingMutation(({ ids, key }: { ids: readonly string[]; key: string }) => source.acceptSuggestions(ids, key));
}

export function useUndoMatch() {
  const source = useBankingSource();
  return useBankingMutation(({ matchId, reason }: { matchId: string; reason: string }) => source.undoMatch(matchId, reason));
}

export function useBuildReconciliation() {
  const source = useBankingSource();
  return useBankingMutation(({ input, key }: { input: BuildReconciliationInput; key: string }) => source.buildReconciliation(input, key));
}

export function useValidateReconciliation() {
  const source = useBankingSource();
  return useBankingMutation(({ id, key }: { id: string; key: string }) => source.validateReconciliation(id, key));
}

export function useDownload() {
  return useMutation({ mutationFn: (load: () => Promise<Blob>) => load() });
}

export function useRefreshBanking() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BANKING_ROOT });
}
