'use client';

import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import { staffCapabilities } from './model';
import type { OrganizationKind, StaffCapabilities, StaffKind, StaffRole } from './model';
import type { StaffMessagerieSource } from './source';

export interface StaffProof {
  dialog: ReactNode;
  intercept: (error: unknown, replay: () => void, abandon?: () => void) => boolean;
}

export type StaffSection = StaffKind | 'team';

export interface StaffRoutes {
  section: (section: StaffSection) => string;
  thread: (id: string) => string;
}

export interface StaffConfig {
  source: StaffMessagerieSource;
  routes: StaffRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
  role: StaffRole;
  organizationKind: OrganizationKind;
  useProof: () => StaffProof;
}

export interface StaffMessagerieProviderProps extends StaffConfig {
  children: ReactNode;
}

const ConfigContext = createContext<(StaffConfig & { capabilities: StaffCapabilities }) | null>(null);

export function StaffMessagerieProvider({ children, ...config }: StaffMessagerieProviderProps) {
  const { source, routes, Link, navigate, role, organizationKind, useProof } = config;
  const value = useMemo(
    () => ({ source, routes, Link, navigate, role, organizationKind, useProof, capabilities: staffCapabilities(role, organizationKind) }),
    [source, routes, Link, navigate, role, organizationKind, useProof],
  );
  return <ConfigContext value={value}>{children}</ConfigContext>;
}

export function useStaffConfig(): StaffConfig & { capabilities: StaffCapabilities } {
  const config = use(ConfigContext);
  if (!config) throw new Error('StaffMessagerieProvider manquant autour de la messagerie externe.');
  return config;
}

export function useOptionalStaffConfig(): (StaffConfig & { capabilities: StaffCapabilities }) | null {
  return use(ConfigContext);
}
