'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import { externalCopy } from './copy';
import type { ExternalCopy } from './copy';
import type { ExternalSpace } from './model';
import type { ExternalMessagerieSource } from './source';

export interface ExternalRoutes {
  inbox: string;
  thread: (id: string) => string;
  newThread: string;
}

export interface ExternalConfig {
  space: ExternalSpace;
  source: ExternalMessagerieSource;
  routes: ExternalRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
}

export interface ExternalMessagerieProviderProps extends ExternalConfig {
  children: ReactNode;
}

const ConfigContext = createContext<ExternalConfig | null>(null);

export function ExternalMessagerieProvider({ children, ...config }: ExternalMessagerieProviderProps) {
  return <ConfigContext value={config}>{children}</ConfigContext>;
}

export function useExternalConfig(): ExternalConfig & { copy: ExternalCopy } {
  const config = use(ConfigContext);
  if (!config) throw new Error('ExternalMessagerieProvider manquant autour de la messagerie.');
  return { ...config, copy: externalCopy[config.space] };
}
