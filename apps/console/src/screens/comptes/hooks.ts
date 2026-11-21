'use client';

import { usePlatformQuery } from '@/platform/context';
import type { AccountLookup } from '@/platform/accounts/accounts';

export const useAccount = (id: string) => usePlatformQuery(['accounts', 'detail', id], (api) => api.accounts.get(id));

export const useAccountSearch = (lookup: AccountLookup | null) =>
  usePlatformQuery(['accounts', 'search', lookup], (api) => (lookup === null ? Promise.resolve([]) : api.accounts.search(lookup)), { enabled: lookup !== null });
