'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { InvestmentsSourceProvider, createApiInvestmentsSource } from '../features/investments';

export function InvestmentsApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiInvestmentsSource({ client: session.client, organizationId: session.organization.organization }) : null), [session]);
  if (!source) throw new Error('InvestmentsApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <InvestmentsSourceProvider source={source}>{children}</InvestmentsSourceProvider>;
}
