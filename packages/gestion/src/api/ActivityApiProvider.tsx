'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ActivitySourceProvider, createApiActivitySource } from '../features/activity';

export function ActivityApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiActivitySource({ client: session.client, organizationId: session.organization.organization }) : null), [session]);
  if (!source) throw new Error('ActivityApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <ActivitySourceProvider source={source}>{children}</ActivitySourceProvider>;
}
