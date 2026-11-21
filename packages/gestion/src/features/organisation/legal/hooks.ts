'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LegalIdentityInput } from './model';
import { useLegalIdentitySource } from './source';

export const LEGAL_ROOT = ['gestion', 'legal-identity'] as const;

export const useLegalPermissions = () => useLegalIdentitySource().permissions;

export function useLegalIdentity() {
  const source = useLegalIdentitySource();
  const query = useQuery({ queryKey: LEGAL_ROOT, queryFn: () => source.load(), retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export function useSaveLegalIdentity() {
  const source = useLegalIdentitySource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LegalIdentityInput) => source.save(input),
    onSuccess: () => client.invalidateQueries({ queryKey: LEGAL_ROOT }),
  });
}
