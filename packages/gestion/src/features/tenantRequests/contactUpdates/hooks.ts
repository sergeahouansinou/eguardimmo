'use client';

import { useGuardedQuery, useScopedMutation } from '../shared/hooks';
import { useContactUpdatesSource } from './source';

export function useContactUpdates(partyId: string, cursor: string | null) {
  const source = useContactUpdatesSource();
  return useGuardedQuery(['contact-updates', partyId, cursor], () => source.list(partyId, cursor));
}

export function useApplyContactUpdate() {
  const source = useContactUpdatesSource();
  return useScopedMutation(({ partyId, id }: { partyId: string; id: string }) => source.apply(partyId, id));
}

export function useDismissContactUpdate() {
  const source = useContactUpdatesSource();
  return useScopedMutation(({ partyId, id }: { partyId: string; id: string }) => source.dismiss(partyId, id));
}
