'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositAttestation, fetchInsurance, withdrawSubmission } from './insuranceRequests';
import type { DepositInput } from './insuranceRequests';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useInsurance(leaseId: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.insurance(leaseId), queryFn: () => fetchInsurance(client, leaseId) });
}

export function useDepositAttestation() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DepositInput) => depositAttestation(client, input),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: tenantKeys.insurance(input.leaseId) }),
  });
}

export function useWithdrawSubmission() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withdrawSubmission(client, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tenant', 'insurance'] }),
  });
}
