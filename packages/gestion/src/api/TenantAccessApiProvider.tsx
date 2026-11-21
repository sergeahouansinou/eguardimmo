'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { TenantAccessSourceProvider, createApiTenantAccessSource } from '../features/locataires/access';

export function TenantAccessApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiTenantAccessSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source) throw new Error('TenantAccessApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <TenantAccessSourceProvider source={source}>{children}</TenantAccessSourceProvider>;
}
