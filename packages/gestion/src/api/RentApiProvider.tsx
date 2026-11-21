'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { RentSourceProvider, createApiRentSource } from '../features/finances/rent';

export function RentApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiRentSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source) throw new Error('RentApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <RentSourceProvider source={source}>{children}</RentSourceProvider>;
}
