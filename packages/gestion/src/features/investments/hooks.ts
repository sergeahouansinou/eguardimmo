'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORG_ROOT, useOrgQuery } from '../orgapi/hooks';
import { useOrgInfoSource } from '../orgapi/source';
import type { AcquisitionInput, AcquisitionUpdate, AttestationInput, FeeInput, LoanFilters, LoanInput, PrepaymentInput } from './model';
import { useInvestmentsSource } from './source';

export const INVESTMENTS_ROOT = ['gestion', 'investments'] as const;
const CHOICE_STALE_MS = 120_000;

export function useInvestmentsCurrency() {
  const source = useInvestmentsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...INVESTMENTS_ROOT, 'currency', organizationId], () => source.currency(), { staleTime: CHOICE_STALE_MS });
}

export function useLoans(filters: LoanFilters, enabled = true) {
  const source = useInvestmentsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...INVESTMENTS_ROOT, 'loans', organizationId, filters], () => source.loans(filters), { enabled });
}

export function useLoan(id: string) {
  const source = useInvestmentsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...INVESTMENTS_ROOT, 'loan', organizationId, id], () => source.loan(id));
}

export function useLoanSchedule(id: string, enabled = true) {
  const source = useInvestmentsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...INVESTMENTS_ROOT, 'schedule', organizationId, id], () => source.schedule(id), { enabled });
}

export function useAcquisitions(propertyId: string | null) {
  const source = useInvestmentsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...INVESTMENTS_ROOT, 'acquisitions', organizationId, propertyId], () => source.acquisitions(propertyId));
}

function useInvestmentsMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: run, onSettled: () => client.invalidateQueries({ queryKey: INVESTMENTS_ROOT }) });
}

export function useCreateLoan() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ input, key }: { input: LoanInput; key: string }) => source.createLoan(input, key));
}

export function usePrepayLoan() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, input }: { id: string; input: PrepaymentInput }) => source.prepay(id, input));
}

export function useImportSchedule() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, file, lockVersion }: { id: string; file: File; lockVersion: number }) => source.importSchedule(id, file, lockVersion));
}

export function useAddFee() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, input }: { id: string; input: FeeInput }) => source.addFee(id, input));
}

export function useAddAttestation() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, input }: { id: string; input: AttestationInput }) => source.addAttestation(id, input));
}

export function useVoidLoan() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, reason, lockVersion }: { id: string; reason: string; lockVersion: number }) => source.voidLoan(id, reason, lockVersion));
}

export function useCreateAcquisition() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ input, key }: { input: AcquisitionInput; key: string }) => source.createAcquisition(input, key));
}

export function useUpdateAcquisition() {
  const source = useInvestmentsSource();
  return useInvestmentsMutation(({ id, input }: { id: string; input: AcquisitionUpdate }) => source.updateAcquisition(id, input));
}

export function useInvestmentsRetry(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: INVESTMENTS_ROOT });
    void client.invalidateQueries({ queryKey: ORG_ROOT });
  };
}
