'use client';

import { accountKeys } from '@eguardimmo/shell';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelEmailChange, confirmEmailChange, fetchContactUpdatesPage, fetchProfile, requestContactUpdate, requestEmailChange, updateName, updatePhone } from './accountRequests';
import type { ContactField } from './accountSchemas';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useProfile() {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.profile, queryFn: () => fetchProfile(client) });
}

function useRefreshProfile() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: tenantKeys.profile }), queryClient.invalidateQueries({ queryKey: accountKeys.identity })]);
}

export function useUpdateName() {
  const { client } = useTenantSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (name: string) => updateName(client, name), onSuccess: refresh });
}

export function useUpdatePhone() {
  const { client } = useTenantSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (phone: string | null) => updatePhone(client, phone), onSuccess: refresh });
}

export function useRequestEmailChange() {
  const { client } = useTenantSession();
  return useMutation({ mutationFn: (email: string) => requestEmailChange(client, email) });
}

export function useCancelEmailChange() {
  const { client } = useTenantSession();
  return useMutation({ mutationFn: () => cancelEmailChange(client) });
}

export function useConfirmEmailChange() {
  const { client } = useTenantSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (code: string) => confirmEmailChange(client, code), onSuccess: refresh });
}

export function useContactUpdates() {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.contactUpdates,
    queryFn: ({ pageParam }) => fetchContactUpdatesPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useRequestContactUpdate() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; fields: readonly ContactField[]; clientId: string }) => requestContactUpdate(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenantKeys.contactUpdates }),
  });
}
