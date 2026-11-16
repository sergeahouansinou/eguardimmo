'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { BauxSourceProvider, createApiBauxSource } from '../features/baux';

export function BauxApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiBauxSource({ client: session.client, organizationId: session.organization.organization }) : null),
    [session],
  );
  if (!source) throw new Error('BauxApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <BauxSourceProvider source={source}>{children}</BauxSourceProvider>;
}
