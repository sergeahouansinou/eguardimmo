'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { z } from 'zod';

export interface ScreenQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

const subscribeNothing = () => () => undefined;

// Les données ne sont lues qu'après l'hydratation, comme useAfterHydration du bureau.
export function useScreenQuery<T>(
  key: readonly unknown[],
  load: () => Promise<unknown>,
  schema: z.ZodType<T>,
): ScreenQuery<T> {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => schema.parse(await load()),
  });
  const refetch = () => {
    void query.refetch();
  };
  if (!hydrated) return { data: undefined, isError: false, isPending: true, refetch };
  return { data: query.data, isError: query.isError, isPending: query.isPending, refetch };
}

export function useSourceMutation<Input, Output = void>(
  run: (input: Input) => Promise<Output>,
  invalidate: readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
}
