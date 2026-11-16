'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { createApiBiensSource } from './api/apiSource';
import { createDemoBiensSource } from './demo/store';
import type { BiensEnvironment } from './environment';
import { BiensProviders } from './provider';
import type { BiensSource } from './source';

export interface BiensRootProps {
  mode: 'demo' | 'api';
  environment: BiensEnvironment;
  children: ReactNode;
}

function useBiensSource(mode: BiensRootProps['mode']): BiensSource {
  const session = useOrganizationSession();
  return useMemo(() => {
    if (mode === 'demo') return createDemoBiensSource();
    if (!session) throw new Error('La source des biens exige une session d’organisation ouverte par OrganizationGate.');
    return createApiBiensSource({ client: session.client, organizationId: session.organization.organization });
  }, [mode, session]);
}

export function BiensRoot({ mode, environment, children }: BiensRootProps) {
  const source = useBiensSource(mode);
  return (
    <BiensProviders source={source} environment={environment}>
      {children}
    </BiensProviders>
  );
}
