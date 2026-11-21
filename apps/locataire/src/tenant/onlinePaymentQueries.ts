'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantKeys } from './keys';
import { cancelOnlinePayment, createOnlinePayment, fetchOnlinePayment, fetchPaymentOptions } from './onlinePaymentRequests';
import type { PayInput } from './onlinePaymentRequests';
import { isLive } from './onlinePaymentSchemas';
import { useTenantSession } from './session';

export const POLL_INTERVAL_MS = 4000;
export const POLL_LIMIT = 15;

export function usePaymentOptions(leaseId: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.paymentOptions(leaseId), queryFn: () => fetchPaymentOptions(client, leaseId), staleTime: 0 });
}

export function useCreateOnlinePayment() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayInput) => createOnlinePayment(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tenant', 'online-payments', 'options'] }),
  });
}

export function useOnlinePayment(id: string) {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  const key = tenantKeys.onlinePayment(id);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchOnlinePayment(client, id),
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data === undefined || !isLive(data.status) || query.state.dataUpdateCount >= POLL_LIMIT) return false;
      return POLL_INTERVAL_MS;
    },
  });
  const updates = queryClient.getQueryState(key)?.dataUpdateCount ?? 0;
  const stalled = query.data !== undefined && isLive(query.data.status) && updates >= POLL_LIMIT;
  return { ...query, stalled };
}

export function useCancelOnlinePayment() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelOnlinePayment(client, id),
    onSettled: (_data, _error, id) => queryClient.invalidateQueries({ queryKey: tenantKeys.onlinePayment(id) }),
  });
}
