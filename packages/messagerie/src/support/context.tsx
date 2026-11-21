'use client';

import { createContext, use, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import { supportCopy } from './copy';
import type { SupportCopy } from './copy';
import type { SupportRequestSpace, SupportRoutes } from './model';
import type { SupportSource } from './source';
import { createSeenTickets } from './unread';
import type { SeenTickets } from './unread';

export interface SupportConfig {
  space: SupportRequestSpace;
  source: SupportSource;
  routes: SupportRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
}

export interface SupportProviderProps extends SupportConfig {
  children: ReactNode;
}

type Resolved = SupportConfig & { copy: SupportCopy; seen: SeenTickets };

const ConfigContext = createContext<Resolved | null>(null);

export function SupportProvider({ children, ...config }: SupportProviderProps) {
  const { space, source, routes, Link, navigate } = config;
  const [seen] = useState(createSeenTickets);
  const value = useMemo(() => ({ space, source, routes, Link, navigate, copy: supportCopy[space], seen }), [space, source, routes, Link, navigate, seen]);
  return <ConfigContext value={value}>{children}</ConfigContext>;
}

export function useSupportConfig(): Resolved {
  const config = use(ConfigContext);
  if (!config) throw new Error('SupportProvider manquant autour du support.');
  return config;
}

export function useOptionalSupportConfig(): Resolved | null {
  return use(ConfigContext);
}
