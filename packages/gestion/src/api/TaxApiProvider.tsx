'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { TaxSourceProvider, createApiTaxSource } from '../features/tax';

export function TaxApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiTaxSource({ client: session.client, organizationId: session.organization.organization }) : null), [session]);
  if (!source) throw new Error('TaxApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <TaxSourceProvider source={source}>{children}</TaxSourceProvider>;
}
