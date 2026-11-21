'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantAccessSource } from './source';

export const ACCESS_ROOT = ['gestion', 'tenant-access'] as const;

export const accessKeys = {
  search: (term: string) => [...ACCESS_ROOT, 'search', term] as const,
  access: (partyId: string) => [...ACCESS_ROOT, 'access', partyId] as const,
};

export const useTenantAccessPermissions = () => useTenantAccessSource().permissions;

export function useTenantSearch(term: string) {
  const source = useTenantAccessSource();
  const query = useQuery({ queryKey: accessKeys.search(term), queryFn: () => source.search(term), retry: false, enabled: source.permissions.manage });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export function useTenantAccess(partyId: string | null) {
  const source = useTenantAccessSource();
  const query = useQuery({
    queryKey: accessKeys.access(partyId ?? ''),
    queryFn: () => source.access(partyId ?? ''),
    retry: false,
    enabled: partyId !== null && source.permissions.manage,
  });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export function useInviteTenant() {
  const source = useTenantAccessSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ partyId, email }: { partyId: string; email: string | null }) => source.invite(partyId, email),
    onSuccess: (access) => { client.setQueryData(accessKeys.access(access.partyId), access); },
  });
}

export function useRevokeTenantAccess() {
  const source = useTenantAccessSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (partyId: string) => source.revoke(partyId),
    onSuccess: (_, partyId) => client.invalidateQueries({ queryKey: accessKeys.access(partyId) }),
  });
}
