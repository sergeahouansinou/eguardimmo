'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { BankingSourceProvider, createApiBankingSource } from '../features/finances/banking';

export function BankingApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiBankingSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source) throw new Error('BankingApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <BankingSourceProvider source={source}>{children}</BankingSourceProvider>;
}
