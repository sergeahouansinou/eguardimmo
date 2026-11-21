'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConformiteSourceProvider, LibrarySourceProvider, createApiConformiteSource, createApiLibrarySource } from '../features/conformite';

export function ConformiteApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const source = useMemo(
    () => (session ? createApiConformiteSource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  const library = useMemo(
    () => (session ? createApiLibrarySource({ client: session.client, organizationId: session.organization.organization, role: session.organization.role }) : null),
    [session],
  );
  if (!source || !library) throw new Error('ConformiteApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return (
    <ConformiteSourceProvider source={source}>
      <LibrarySourceProvider source={library}>{children}</LibrarySourceProvider>
    </ConformiteSourceProvider>
  );
}
