'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canRead, canWrite } from './permissions';
import { useOrgInfoSource } from './source';

export const ORG_ROOT = ['gestion', 'org'] as const;
const CHOICE_STALE_MS = 120_000;

export interface OrgQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

export function useOrgQuery<T>(key: readonly unknown[], load: () => Promise<T>, options: { enabled?: boolean; staleTime?: number } = {}): OrgQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled: options.enabled ?? true, retry: false, gcTime: options.staleTime ? undefined : 0, staleTime: options.staleTime ?? 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export function useOrgTimezone() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'timezone', source.organizationId], () => source.timezone(), { staleTime: CHOICE_STALE_MS });
}

export function useCurrentUser() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'me'], () => source.currentUser(), { staleTime: CHOICE_STALE_MS });
}

export function useOrgMembers() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'members', source.organizationId], () => source.members(), { staleTime: CHOICE_STALE_MS });
}

export function useRoleMatrix() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'roles', source.organizationId], () => source.roles(), { staleTime: CHOICE_STALE_MS });
}

export function useOrgPropertyChoices() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'properties', source.organizationId], () => source.properties(), { staleTime: CHOICE_STALE_MS });
}

export function useOrgUnitChoices(propertyId: string | null) {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'units', source.organizationId, propertyId ?? ''], () => source.units(propertyId ?? ''), { enabled: propertyId !== null && propertyId !== '', staleTime: CHOICE_STALE_MS });
}

export function useOrgLeaseChoices() {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'leases', source.organizationId], () => source.leases(), { staleTime: CHOICE_STALE_MS });
}

export function useUpdateTimezone() {
  const source = useOrgInfoSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (timezone: string) => source.updateTimezone(timezone),
    onSettled: () => client.invalidateQueries({ queryKey: ORG_ROOT }),
  });
}

export function useOrgPermission(domain: string): { pending: boolean; read: boolean; write: boolean } {
  const matrix = useRoleMatrix();
  return { pending: matrix.isPending && !matrix.isError, read: canRead(matrix.data, domain), write: canWrite(matrix.data, domain) };
}

export function usePartySearch(search: string) {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'party-search', source.organizationId, search], () => source.searchParties(search), { staleTime: CHOICE_STALE_MS });
}

export function usePartyChoice(id: string | null) {
  const source = useOrgInfoSource();
  return useOrgQuery([...ORG_ROOT, 'party', source.organizationId, id ?? ''], () => source.party(id ?? ''), { enabled: id !== null && id !== '', staleTime: CHOICE_STALE_MS });
}
