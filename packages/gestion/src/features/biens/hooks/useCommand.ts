'use client';

import { useToast } from '@eguardimmo/ui';
import { BiensError } from '../errors';
import { useBiensAction } from '../queries';
import type { BiensSource } from '../source';

export interface CommandOptions<Args, Result> {
  success: (result: Result, args: Args) => string;
  onDone?: (result: Result, args: Args) => void;
}

export function errorMessage(error: unknown): string {
  return error instanceof BiensError ? error.message : 'Une erreur est survenue. Réessayez dans un instant.';
}

export function useCommand<Args, Result>(
  run: (source: BiensSource, args: Args) => Promise<Result>,
  options: CommandOptions<Args, Result>,
) {
  const mutation = useBiensAction(run);
  const toast = useToast();
  const execute = (args: Args) => {
    mutation.mutate(args, {
      onSuccess: (result) => {
        toast.show({ tone: 'success', title: options.success(result, args) });
        options.onDone?.(result, args);
      },
      onError: (error) => {
        toast.show({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
      },
    });
  };
  return { execute, isPending: mutation.isPending };
}
