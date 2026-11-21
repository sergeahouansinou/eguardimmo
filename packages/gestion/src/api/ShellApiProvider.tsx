'use client';

import { NotificationsApiProvider, useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { GestionSourceProvider } from '../data/source';
import { createApiShellSource } from './shellSource';

export function ShellApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(() => (session ? createApiShellSource(session.client, session) : null), [session]);
  if (!source || !session) throw new Error('ShellApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return (
    <GestionSourceProvider source={source}>
      <NotificationsApiProvider client={session.client} organizationId={session.organization.organization}>
        {children}
      </NotificationsApiProvider>
    </GestionSourceProvider>
  );
}
