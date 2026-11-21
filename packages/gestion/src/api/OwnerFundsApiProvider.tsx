'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { OwnerFundsSourceProvider, createApiOwnerFundsSource } from '../features/finances/ownerfunds';

export function OwnerFundsApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiOwnerFundsSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('OwnerFundsApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <OwnerFundsSourceProvider source={source}>{children}</OwnerFundsSourceProvider>;
}
