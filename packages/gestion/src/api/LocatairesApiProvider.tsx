'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { LocatairesSourceProvider, createApiLocatairesSource } from '../features/locataires';

export function LocatairesApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiLocatairesSource({ client: session.client, organizationId: session.organization.organization }) : null),
    [session],
  );
  if (!source) throw new Error('LocatairesApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <LocatairesSourceProvider source={source}>{children}</LocatairesSourceProvider>;
}
