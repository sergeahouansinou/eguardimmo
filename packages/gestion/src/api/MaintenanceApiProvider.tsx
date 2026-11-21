'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { MaintenanceSourceProvider, createApiMaintenanceSource } from '../features/maintenance';

export function MaintenanceApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiMaintenanceSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('MaintenanceApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <MaintenanceSourceProvider source={source}>{children}</MaintenanceSourceProvider>;
}
