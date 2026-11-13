'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { bureauSchema, shellSchema } from './schemas';
import type { BureauData, ShellData } from './schemas';
import { useGestionSource } from './source';

export const gestionKeys = {
  shell: ['gestion', 'shell'] as const,
  bureau: ['gestion', 'bureau'] as const,
};

export interface ClientQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
}

const subscribeNothing = () => () => undefined;

// Les données ne sont lues qu'après l'hydratation : une requête résolue avant
// l'hydratation d'un sous-arbre provoquerait sinon un écart serveur/client.
function useAfterHydration<T>(query: UseQueryResult<T>): ClientQuery<T> {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!hydrated) return { data: undefined, isError: false, isPending: true };
  return { data: query.data, isError: query.isError, isPending: query.isPending };
}

export function useShellData(): ClientQuery<ShellData> {
  const source = useGestionSource();
  return useAfterHydration(
    useQuery({
      queryKey: gestionKeys.shell,
      queryFn: async () => shellSchema.parse(await source.shell()),
    }),
  );
}

export function useBureau(): ClientQuery<BureauData> {
  const source = useGestionSource();
  return useAfterHydration(
    useQuery({
      queryKey: gestionKeys.bureau,
      queryFn: async () => bureauSchema.parse(await source.bureau()),
    }),
  );
}

export function useMarkAllNotificationsRead() {
  const source = useGestionSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => source.markAllNotificationsRead(),
    onSuccess: () => client.invalidateQueries({ queryKey: gestionKeys.shell }),
  });
}
