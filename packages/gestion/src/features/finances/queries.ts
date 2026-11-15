'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { CommandResult, FinancesCommand } from './commands';
import { parseFinances, useFinancesSource } from './source';
import type { FinancesData } from './schemas';

export const financesKeys = { data: ['finances', 'data'] as const };

export interface FinancesQuery {
  data: FinancesData | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

const subscribeNothing = () => () => undefined;

export function useFinances(): FinancesQuery {
  const source = useFinancesSource();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const query = useQuery({ queryKey: financesKeys.data, queryFn: async () => parseFinances(await source.snapshot()) });
  const refetch = () => {
    void query.refetch();
  };
  if (!hydrated) return { data: undefined, isError: false, isPending: true, refetch };
  return { data: query.data, isError: query.isError, isPending: query.isPending, refetch };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CommandDraft = DistributiveOmit<FinancesCommand, 'requestKey'>;

export const newRequestKey = (): string => globalThis.crypto.randomUUID();

export interface CommandInvocation {
  command: CommandDraft;
  requestKey?: string;
}

export function useFinancesCommand() {
  const source = useFinancesSource();
  const client = useQueryClient();
  return useMutation<CommandResult, Error, CommandInvocation>({
    mutationFn: ({ command, requestKey }) => source.dispatch({ ...command, requestKey: requestKey ?? newRequestKey() }),
    onSuccess: () => client.invalidateQueries({ queryKey: financesKeys.data }),
  });
}
