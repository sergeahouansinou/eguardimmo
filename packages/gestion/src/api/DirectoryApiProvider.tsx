'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { DirectorySourceProvider, createApiDirectorySource } from '../features/directory';

export function DirectoryApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () =>
      session
        ? createApiDirectorySource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role, kind: session.organization.kind })
        : null,
    [session],
  );
  if (!source) throw new Error('DirectoryApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return <DirectorySourceProvider source={source}>{children}</DirectorySourceProvider>;
}
