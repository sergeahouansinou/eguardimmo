'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { shellSchema } from './schemas';
import type { ShellData } from './schemas';
import { useShellSource } from './source';

export const shellKeys = {
  data: ['shell', 'data'] as const,
};

export interface ClientQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
}

const subscribeNothing = () => () => undefined;

// Les données ne sont lues qu'après l'hydratation : une requête résolue avant
// l'hydratation d'un sous-arbre provoquerait sinon un écart serveur/client.
export function useAfterHydration<T>(query: UseQueryResult<T>): ClientQuery<T> {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!hydrated) return { data: undefined, isError: false, isPending: true };
  return { data: query.data, isError: query.isError, isPending: query.isPending };
}

export function useShellData(): ClientQuery<ShellData> {
  const source = useShellSource();
  return useAfterHydration(
    useQuery({
      queryKey: shellKeys.data,
      queryFn: async () => shellSchema.parse(await source.shell()),
    }),
  );
}

export function useMarkAllNotificationsRead() {
  const source = useShellSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => source.markAllNotificationsRead(),
    onSuccess: () => client.invalidateQueries({ queryKey: shellKeys.data }),
  });
}
