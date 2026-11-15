'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import type { ClientQuery } from '@eguardimmo/shell';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';

export function useClientQuery<T>(
  key: readonly unknown[],
  load: () => Promise<unknown>,
  schema: z.ZodType<T>,
): ClientQuery<T> {
  return useAfterHydration(
    useQuery({
      queryKey: key,
      queryFn: async () => schema.parse(await load()),
    }),
  );
}
