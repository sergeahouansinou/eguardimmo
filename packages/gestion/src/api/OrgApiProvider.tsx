'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { OrgInfoSourceProvider, createApiOrgInfoSource } from '../features/orgapi';

export function OrgApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiOrgInfoSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind }) : null),
    [session],
  );
  if (!source) throw new Error('OrgApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <OrgInfoSourceProvider source={source}>{children}</OrgInfoSourceProvider>;
}
