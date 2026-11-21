'use client';

import { useGuardedQuery, useScopedMutation } from '../shared/hooks';
import type { PaymentQuery } from './model';
import { useOnlinePaymentsSource } from './source';

export function useOnlinePayments(query: PaymentQuery) {
  const source = useOnlinePaymentsSource();
  return useGuardedQuery(['online-payments', query], () => source.list(query));
}

export function usePaymentAccount(enabled: boolean) {
  const source = useOnlinePaymentsSource();
  return useGuardedQuery(['payment-account'], () => source.account(), { enabled });
}

export function useOnboardAccount() {
  const source = useOnlinePaymentsSource();
  return useScopedMutation(() => source.onboard());
}
