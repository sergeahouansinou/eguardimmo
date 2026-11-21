'use client';

import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import type { OrganizationKind, StaffRole } from '../external/staff/model';
import type { StaffProof } from '../external/staff/context';
import { campaignCapabilities } from './model';
import type { CampaignCapabilities } from './model';
import type { CampaignsSource } from './source';

export interface CampaignsRoutes {
  list: string;
  newCampaign: string;
  detail: (id: string) => string;
  edit: (id: string) => string;
  messages: string;
}

export interface CampaignsConfig {
  source: CampaignsSource;
  routes: CampaignsRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
  role: StaffRole;
  organizationKind: OrganizationKind;
  useProof: () => StaffProof;
  senderName?: string | null;
  now?: () => Date;
}

export interface CampaignsProviderProps extends CampaignsConfig {
  children: ReactNode;
}

type Resolved = Omit<CampaignsConfig, 'now' | 'senderName'> & { now: () => Date; senderName: string | null; capabilities: CampaignCapabilities };

const ConfigContext = createContext<Resolved | null>(null);

const systemClock = () => new Date();

export function CampaignsProvider({ children, ...config }: CampaignsProviderProps) {
  const { source, routes, Link, navigate, role, organizationKind, useProof, senderName = null, now = systemClock } = config;
  const value = useMemo(
    () => ({ source, routes, Link, navigate, role, organizationKind, useProof, senderName, now, capabilities: campaignCapabilities(role, organizationKind) }),
    [source, routes, Link, navigate, role, organizationKind, useProof, senderName, now],
  );
  return <ConfigContext value={value}>{children}</ConfigContext>;
}

export function useCampaignsConfig(): Resolved {
  const config = use(ConfigContext);
  if (!config) throw new Error('CampaignsProvider manquant autour des campagnes.');
  return config;
}
