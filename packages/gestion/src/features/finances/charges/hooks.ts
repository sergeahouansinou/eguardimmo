'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense, ExerciseInput, ExerciseQuery, ExpenseExportQuery, ExpenseInput, ExpenseQuery, ItemInput, KeyInput, PlanInput } from './model';
import { useChargesSource } from './source';

export const CHARGES_ROOT = ['gestion', 'charges'] as const;
const CHOICES_ROOT = ['gestion', 'charges-choices'] as const;

export const chargesKeys = {
  expenses: (query: ExpenseQuery) => [...CHARGES_ROOT, 'expenses', query] as const,
  expense: (id: string) => [...CHARGES_ROOT, 'expense', id] as const,
  keys: (propertyId: string) => [...CHARGES_ROOT, 'keys', propertyId] as const,
  exercises: (query: ExerciseQuery) => [...CHARGES_ROOT, 'exercises', query] as const,
  exercise: (id: string) => [...CHARGES_ROOT, 'exercise', id] as const,
  statement: (id: string) => [...CHARGES_ROOT, 'statement', id] as const,
  properties: () => [...CHOICES_ROOT, 'properties'] as const,
  units: (propertyId: string) => [...CHOICES_ROOT, 'units', propertyId] as const,
  sourceExpenses: (propertyId: string) => [...CHARGES_ROOT, 'source-expenses', propertyId] as const,
  terms: (vocabulary: string) => [...CHOICES_ROOT, 'terms', vocabulary] as const,
  currency: () => [...CHOICES_ROOT, 'currency'] as const,
};

export interface ChargesQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useChargesQuery<T>(key: readonly unknown[], load: () => Promise<T>, options: { enabled?: boolean; staleTime?: number } = {}): ChargesQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled: options.enabled ?? true, retry: false, gcTime: options.staleTime ? undefined : 0, staleTime: options.staleTime ?? 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useChargesPermissions = () => useChargesSource().permissions;

export function useExpenses(query: ExpenseQuery) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.expenses(query), () => source.expenses(query));
}

export function useExpense(id: string) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.expense(id), () => source.expense(id));
}

export function useChargeKeys(propertyId: string | null) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.keys(propertyId ?? ''), () => source.keys(propertyId ?? ''), { enabled: propertyId !== null && propertyId !== '' });
}

export function useExercises(query: ExerciseQuery) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.exercises(query), () => source.exercises(query));
}

export function useExercise(id: string) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.exercise(id), () => source.exercise(id));
}

export function useStatement(id: string) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.statement(id), () => source.statement(id));
}

const SOURCE_PAGES_MAX = 10;

export function useSourceExpenses(propertyId: string | null) {
  const source = useChargesSource();
  return useChargesQuery(
    chargesKeys.sourceExpenses(propertyId ?? ''),
    async () => {
      const all: Expense[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < SOURCE_PAGES_MAX; page += 1) {
        const result = await source.expenses({ cursor, propertyId, status: 'recorded', settlement: null, from: null, to: null });
        all.push(...result.items);
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      return all;
    },
    { enabled: propertyId !== null && propertyId !== '' },
  );
}

const CHOICE_STALE_MS = 120_000;

export function usePropertyChoices() {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.properties(), () => source.properties(), { staleTime: CHOICE_STALE_MS });
}

export function useUnitChoices(propertyId: string | null) {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.units(propertyId ?? ''), () => source.units(propertyId ?? ''), { enabled: propertyId !== null && propertyId !== '', staleTime: CHOICE_STALE_MS });
}

export function useTerms(vocabulary: 'expense_category' | 'charge_rubric') {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.terms(vocabulary), () => source.terms(vocabulary), { staleTime: CHOICE_STALE_MS });
}

export function useChargesCurrency() {
  const source = useChargesSource();
  return useChargesQuery(chargesKeys.currency(), () => source.currency(), { staleTime: CHOICE_STALE_MS });
}

function useChargesMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: CHARGES_ROOT }),
  });
}

export function useRecordExpense() {
  const source = useChargesSource();
  return useChargesMutation(({ input, key }: { input: ExpenseInput; key: string }) => source.recordExpense(input, key));
}

export function useCancelExpense() {
  const source = useChargesSource();
  return useChargesMutation(({ id, reason }: { id: string; reason: string }) => source.cancelExpense(id, reason));
}

export function useApproveExpense() {
  const source = useChargesSource();
  return useChargesMutation((id: string) => source.approveExpense(id));
}

export function useAttachExpenseFile() {
  const source = useChargesSource();
  return useChargesMutation(({ id, file }: { id: string; file: File }) => source.attachExpenseFile(id, file));
}

export function useCreateKey() {
  const source = useChargesSource();
  return useChargesMutation(({ propertyId, input }: { propertyId: string; input: KeyInput }) => source.createKey(propertyId, input));
}

export function useAddKeyVersion() {
  const source = useChargesSource();
  return useChargesMutation(({ propertyId, keyId, validFrom, shares }: { propertyId: string; keyId: string; validFrom: string; shares: KeyInput['shares'] }) => source.addKeyVersion(propertyId, keyId, validFrom, shares));
}

export function useArchiveKey() {
  const source = useChargesSource();
  return useChargesMutation(({ propertyId, keyId }: { propertyId: string; keyId: string }) => source.archiveKey(propertyId, keyId));
}

export function useCreateExercise() {
  const source = useChargesSource();
  return useChargesMutation((input: ExerciseInput) => source.createExercise(input));
}

export function useUpdateExercise() {
  const source = useChargesSource();
  return useChargesMutation(({ id, lockVersion, items }: { id: string; lockVersion: number; items: readonly ItemInput[] }) => source.updateExercise(id, lockVersion, items));
}

export function useComputeExercise() {
  const source = useChargesSource();
  return useChargesMutation((id: string) => source.computeExercise(id));
}

export function useDiscardExercise() {
  const source = useChargesSource();
  return useChargesMutation((id: string) => source.discardExercise(id));
}

export function useIssueExercise() {
  const source = useChargesSource();
  return useChargesMutation(({ id, key, acknowledge }: { id: string; key: string; acknowledge: boolean }) => source.issueExercise(id, key, acknowledge));
}

export function useRetryStatement() {
  const source = useChargesSource();
  return useChargesMutation(({ id, key }: { id: string; key: string }) => source.retryStatement(id, key));
}

export function useRectifyStatement() {
  const source = useChargesSource();
  return useChargesMutation(({ id, reason, key }: { id: string; reason: string; key: string }) => source.rectifyStatement(id, reason, key));
}

export function useRecordPlan() {
  const source = useChargesSource();
  return useChargesMutation(({ id, input, key }: { id: string; input: PlanInput; key: string }) => source.recordPlan(id, input, key));
}

export function useShareStatementFile() {
  const source = useChargesSource();
  return useChargesMutation(({ statementId, fileId, visible }: { statementId: string; fileId: string; visible: boolean }) => source.shareStatementFile(statementId, fileId, visible));
}

export function useDownload() {
  return useMutation({ mutationFn: (load: () => Promise<Blob>) => load() });
}

export function useExportExpenses() {
  const source = useChargesSource();
  return useMutation({ mutationFn: (query: ExpenseExportQuery) => source.exportExpenses(query) });
}
