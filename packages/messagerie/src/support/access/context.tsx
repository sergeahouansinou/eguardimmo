'use client';

import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import type { StaffProof } from '../../external/staff/context';
import type { StaffRole } from '../../external/staff/model';
import { canManageAccess } from './model';
import type { AccessRoutes } from './model';
import type { SupportAccessSource } from './source';

export interface SupportAccessConfig {
  source: SupportAccessSource;
  routes: AccessRoutes;
  Link: LinkComponent;
  role: StaffRole;
  useProof: () => StaffProof;
}

export interface SupportAccessProviderProps extends SupportAccessConfig {
  children: ReactNode;
}

type Resolved = SupportAccessConfig & { canManage: boolean };

const ConfigContext = createContext<Resolved | null>(null);

export function SupportAccessProvider({ children, ...config }: SupportAccessProviderProps) {
  const { source, routes, Link, role, useProof } = config;
  const value = useMemo(() => ({ source, routes, Link, role, useProof, canManage: canManageAccess(role) }), [source, routes, Link, role, useProof]);
  return <ConfigContext value={value}>{children}</ConfigContext>;
}

export function useSupportAccessConfig(): Resolved {
  const config = use(ConfigContext);
  if (!config) throw new Error('SupportAccessProvider manquant autour des accès du support.');
  return config;
}

export function useOptionalSupportAccessConfig(): Resolved | null {
  return use(ConfigContext);
}
