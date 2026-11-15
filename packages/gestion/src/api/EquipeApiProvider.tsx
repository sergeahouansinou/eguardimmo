'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { EquipeSourceProvider, createApiEquipeSource } from '../features/compte';

export function EquipeApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiEquipeSource(session.client, session.organization.organization) : null), [session]);
  if (!source) return children;
  return <EquipeSourceProvider source={source}>{children}</EquipeSourceProvider>;
}
