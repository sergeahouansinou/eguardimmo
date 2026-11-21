'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { AnalyticsSourceProvider, createApiAnalyticsSource } from '../features/analytics';

export function AnalyticsApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiAnalyticsSource({ client: session.client, organizationId: session.organization.organization }) : null), [session]);
  if (!source) throw new Error('AnalyticsApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <AnalyticsSourceProvider source={source}>{children}</AnalyticsSourceProvider>;
}
