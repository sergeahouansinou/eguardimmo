'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChargesSourceProvider, createApiChargesSource } from '../features/finances/charges';

export function ChargesApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiChargesSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('ChargesApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <ChargesSourceProvider source={source}>{children}</ChargesSourceProvider>;
}
