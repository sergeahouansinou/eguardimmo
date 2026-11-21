'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { createApiPlanningSource } from '../features/planning/api/source';
import { PlanningSourceProvider } from '../features/planning/source';

export function PlanningApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiPlanningSource({ client: session.client, organizationId: session.organization.organization }) : null), [session]);
  if (!source) throw new Error('PlanningApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <PlanningSourceProvider source={source}>{children}</PlanningSourceProvider>;
}
