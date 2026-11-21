'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import type { ExternalSpace } from '../external/model';
import type { AnnouncementsSource } from './source';

export interface AnnouncementsRoutes {
  list: string;
  detail: (id: string) => string;
  messages: string;
}

export interface AnnouncementsConfig {
  space: ExternalSpace;
  source: AnnouncementsSource;
  routes: AnnouncementsRoutes;
  Link: LinkComponent;
}

export interface AnnouncementsProviderProps extends AnnouncementsConfig {
  children: ReactNode;
}

const ConfigContext = createContext<AnnouncementsConfig | null>(null);

export function AnnouncementsProvider({ children, ...config }: AnnouncementsProviderProps) {
  return <ConfigContext value={config}>{children}</ConfigContext>;
}

export function useAnnouncementsConfig(): AnnouncementsConfig {
  const config = use(ConfigContext);
  if (!config) throw new Error('AnnouncementsProvider manquant autour des annonces.');
  return config;
}
