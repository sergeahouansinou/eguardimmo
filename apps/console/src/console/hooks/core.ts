'use client';

import { shellKeys, useAfterHydration } from '@eguardimmo/shell';
import type { ClientQuery } from '@eguardimmo/shell';
import { ApiError } from '@eguardimmo/api';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { ConsoleError } from '../schemas';
import { useConsoleSource } from '../source';
import type { ConsoleSource } from '../source';

export const CONSOLE_KEY = 'console';

export interface ConsoleQuery<T> extends ClientQuery<T> {
  error: unknown;
  refetch: () => void;
}

export function useConsoleQuery<T>(
  key: readonly unknown[],
  load: (source: ConsoleSource) => Promise<unknown>,
  schema: z.ZodType<T>,
  { keepPrevious = false }: { keepPrevious?: boolean } = {},
): ConsoleQuery<T> {
  const source = useConsoleSource();
  const query = useQuery({
    queryKey: [CONSOLE_KEY, ...key],
    queryFn: async () => schema.parse(await load(source)),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    retry: (failures, error) => !(error instanceof ConsoleError) && !(error instanceof ApiError && error.status < 500) && failures < 1,
  });
  const base = useAfterHydration(query);
  return {
    ...base,
    error: base.isError ? query.error : null,
    refetch: () => { void query.refetch(); },
  };
}

export function useConsoleMutation<Args = undefined, Result = void>(run: (source: ConsoleSource, args: Args) => Promise<Result>) {
  const source = useConsoleSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => run(source, args),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [CONSOLE_KEY] }),
        client.invalidateQueries({ queryKey: shellKeys.data }),
      ]);
    },
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ConsoleError) return error.message;
  if (error instanceof Error && error.name === 'ZodError') return 'Certains champs sont invalides. Vérifiez la saisie.';
  return 'L’opération a échoué. Réessayez dans un instant.';
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ConsoleError && error.code === 'not_found';
}
