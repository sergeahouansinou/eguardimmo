'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@eguardimmo/api';
import { tenantKeys } from './keys';
import { fetchLease, fetchLeasesPage, fetchLinks, revokeLink } from './requests';
import { useTenantSession } from './session';

export function useLeases() {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.leases,
    queryFn: ({ pageParam }) => fetchLeasesPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useLease(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.lease(id), queryFn: () => fetchLease(client, id) });
}

export function useLinks() {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.links, queryFn: () => fetchLinks(client) });
}

export function useRevokeLink() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (partyId: string) => revokeLink(client, partyId),
    onSettled: async (_data, error) => {
      if (error !== null && !(error instanceof ApiError && error.status === 404)) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tenantKeys.links }),
        queryClient.invalidateQueries({ queryKey: tenantKeys.leases }),
        queryClient.invalidateQueries({ queryKey: [...tenantKeys.all, 'lease'] }),
        queryClient.invalidateQueries({ queryKey: tenantKeys.session }),
      ]);
    },
  });
}
