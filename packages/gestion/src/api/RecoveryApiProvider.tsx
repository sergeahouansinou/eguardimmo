'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { RecoverySourceProvider, createApiRecoverySource } from '../features/finances/recovery';

export function RecoveryApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiRecoverySource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source) throw new Error('RecoveryApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <RecoverySourceProvider source={source}>{children}</RecoverySourceProvider>;
}
