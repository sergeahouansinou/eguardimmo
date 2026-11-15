'use client';

import { ToastProvider } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { BiensEnvironmentProvider } from './environment';
import type { BiensEnvironment } from './environment';
import { BiensSourceProvider } from './source';
import type { BiensSource } from './source';

export interface BiensProvidersProps {
  source: BiensSource;
  environment: BiensEnvironment;
  children: ReactNode;
}

export function BiensProviders({ source, environment, children }: BiensProvidersProps) {
  return (
    <BiensSourceProvider source={source}>
      <BiensEnvironmentProvider environment={environment}>
        <ToastProvider>{children}</ToastProvider>
      </BiensEnvironmentProvider>
    </BiensSourceProvider>
  );
}
