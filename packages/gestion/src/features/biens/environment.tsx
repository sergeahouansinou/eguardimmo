'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';

export interface BiensEnvironment {
  Link: LinkComponent;
  pathname: string;
  push: (href: string) => void;
}

const EnvironmentContext = createContext<BiensEnvironment | null>(null);

export function BiensEnvironmentProvider({ environment, children }: { environment: BiensEnvironment; children: ReactNode }) {
  return <EnvironmentContext value={environment}>{children}</EnvironmentContext>;
}

export function useBiensEnvironment(): BiensEnvironment {
  const environment = use(EnvironmentContext);
  if (!environment) throw new Error('BiensProviders manquant autour des écrans de biens.');
  return environment;
}
