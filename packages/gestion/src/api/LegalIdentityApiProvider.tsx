'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { LegalIdentitySourceProvider, createApiLegalIdentitySource } from '../features/organisation/legal';

export function LegalIdentityApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiLegalIdentitySource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source) throw new Error('LegalIdentityApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <LegalIdentitySourceProvider source={source}>{children}</LegalIdentitySourceProvider>;
}
