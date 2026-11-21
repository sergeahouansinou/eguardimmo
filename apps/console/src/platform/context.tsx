'use client';

import { ApiError } from '@eguardimmo/api';
import { shellKeys, useAfterHydration } from '@eguardimmo/shell';
import type { ClientQuery } from '@eguardimmo/shell';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { PlatformApi } from './api';
import { UnexpectedResponseError } from './errors';

const PlatformContext = createContext<PlatformApi | null>(null);

export function PlatformApiProvider({ api, children }: { api: PlatformApi; children: ReactNode }) {
  return <PlatformContext value={api}>{children}</PlatformContext>;
}

export function usePlatformApi(): PlatformApi {
  const api = use(PlatformContext);
  if (!api) throw new Error('PlatformApiProvider manquant autour de la console.');
  return api;
}

export const PLATFORM_KEY = 'platform';

export interface PlatformQuery<T> extends ClientQuery<T> {
  error: unknown;
  refetch: () => void;
}

function retryable(failures: number, error: Error): boolean {
  if (error instanceof UnexpectedResponseError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failures < 1;
}

export function usePlatformQuery<T>(
  key: readonly unknown[],
  load: (api: PlatformApi) => Promise<T>,
  { keepPrevious = false, enabled = true }: { keepPrevious?: boolean; enabled?: boolean } = {},
): PlatformQuery<T> {
  const api = usePlatformApi();
  const query = useQuery({
    queryKey: [PLATFORM_KEY, ...key],
    queryFn: () => load(api),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    enabled,
    retry: retryable,
  });
  const base = useAfterHydration(query);
  return { ...base, error: base.isError ? query.error : null, refetch: () => { void query.refetch(); } };
}

export function usePlatformMutation<Args = void, Result = void>(run: (api: PlatformApi, args: Args) => Promise<Result>) {
  const api = usePlatformApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => run(api, args),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: [PLATFORM_KEY] }), client.invalidateQueries({ queryKey: shellKeys.data })]);
    },
  });
}
