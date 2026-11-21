'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ReportingSourceProvider, createApiReportingSource } from '../features/reporting';

export function ReportingApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiReportingSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('ReportingApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <ReportingSourceProvider source={source}>{children}</ReportingSourceProvider>;
}
