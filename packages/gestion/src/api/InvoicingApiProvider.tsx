'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { InvoicingSourceProvider, createApiInvoicingSource } from '../features/finances/invoicing';

export function InvoicingApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiInvoicingSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('InvoicingApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <InvoicingSourceProvider source={source}>{children}</InvoicingSourceProvider>;
}
