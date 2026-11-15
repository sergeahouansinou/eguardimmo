'use client';

import { shellKeys, useAfterHydration } from '@eguardimmo/shell';
import { useQuery } from '@tanstack/react-query';
import type { ClientQuery } from '@eguardimmo/shell';
import { bureauSchema } from './schemas';
import type { BureauData } from './schemas';
import { useGestionSource } from './source';

export const gestionKeys = {
  shell: shellKeys.data,
  bureau: ['gestion', 'bureau'] as const,
};

export function useBureau(): ClientQuery<BureauData> {
  const source = useGestionSource();
  return useAfterHydration(
    useQuery({
      queryKey: gestionKeys.bureau,
      queryFn: async () => bureauSchema.parse(await source.bureau()),
    }),
  );
}
