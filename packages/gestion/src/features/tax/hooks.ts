'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORG_ROOT, useOrgQuery } from '../orgapi/hooks';
import { useOrgInfoSource } from '../orgapi/source';
import type { RectificationInput, TaxQuery } from './model';
import { useTaxSource } from './source';

export const TAX_ROOT = ['gestion', 'tax'] as const;
const CHOICE_STALE_MS = 120_000;

function useScope() {
  return useOrgInfoSource().organizationId;
}

export function useRentalIncome(year: number, householdComplete: boolean) {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'income', organizationId, year, householdComplete], () => source.rentalIncome(year, householdComplete));
}

export function useSummaries(query: TaxQuery) {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'summaries', organizationId, query], () => source.summaries(query));
}

export function useSummary(id: string) {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'summary', organizationId, id], () => source.summary(id));
}

export function useStatements(query: TaxQuery) {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'statements', organizationId, query], () => source.statements(query));
}

export function useStatement(id: string) {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'statement', organizationId, id], () => source.statement(id));
}

export function useTaxMandants() {
  const source = useTaxSource();
  const organizationId = useScope();
  return useOrgQuery([...TAX_ROOT, 'mandants', organizationId], () => source.mandants(), { staleTime: CHOICE_STALE_MS });
}

function useTaxMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: run, onSettled: () => client.invalidateQueries({ queryKey: TAX_ROOT }) });
}

export function useCreateSummary() {
  const source = useTaxSource();
  return useTaxMutation(({ incomeYear, householdComplete, key }: { incomeYear: number; householdComplete: boolean; key: string }) => source.createSummary({ incomeYear, householdComplete }, key));
}

export function useRectifySummary() {
  const source = useTaxSource();
  return useTaxMutation(({ id, input, key }: { id: string; input: RectificationInput; key: string }) => source.rectifySummary(id, input, key));
}

export function useGenerateStatements() {
  const source = useTaxSource();
  return useTaxMutation(({ incomeYear, mandantIds, key }: { incomeYear: number; mandantIds: string[]; key: string }) => source.generateStatements({ incomeYear, mandantIds }, key));
}

export function usePublishStatement() {
  const source = useTaxSource();
  return useTaxMutation(({ id, lockVersion }: { id: string; lockVersion: number }) => source.publishStatement(id, lockVersion));
}

export function useRectifyStatement() {
  const source = useTaxSource();
  return useTaxMutation(({ id, input, key }: { id: string; input: RectificationInput; key: string }) => source.rectifyStatement(id, input, key));
}

export function useTaxRetry(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: TAX_ROOT });
    void client.invalidateQueries({ queryKey: ORG_ROOT });
  };
}
