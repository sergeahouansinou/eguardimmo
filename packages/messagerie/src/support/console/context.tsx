'use client';

import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import type { ConsoleSupportRoutes } from './model';
import type { ConsoleSupportSource } from './source';

export interface ConsoleSupportConfig {
  source: ConsoleSupportSource;
  routes: ConsoleSupportRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
}

export interface ConsoleSupportProviderProps extends ConsoleSupportConfig {
  children: ReactNode;
}

const ConfigContext = createContext<ConsoleSupportConfig | null>(null);

export function ConsoleSupportProvider({ children, ...config }: ConsoleSupportProviderProps) {
  const { source, routes, Link, navigate } = config;
  const value = useMemo(() => ({ source, routes, Link, navigate }), [source, routes, Link, navigate]);
  return <ConfigContext value={value}>{children}</ConfigContext>;
}

export function useConsoleSupportConfig(): ConsoleSupportConfig {
  const config = use(ConfigContext);
  if (!config) throw new Error('ConsoleSupportProvider manquant autour du support de la console.');
  return config;
}
