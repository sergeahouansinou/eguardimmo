'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';
import { MessagerieSourceProvider } from './data/source';
import type { MessagerieSource } from './data/source';
import type { MessagerieProfile } from './profiles';

export interface MessagerieRoutes {
  inbox: string;
  conversation: (id: string) => string;
  newMessage: string;
  campaigns: string;
  newCampaign: string;
  editCampaign: (id: string) => string;
  help: string;
  supportBoard: string;
  ticket: (id: string) => string;
}

export interface MessagerieConfig {
  profile: MessagerieProfile;
  routes: MessagerieRoutes;
  Link: LinkComponent;
  navigate: (href: string) => void;
}

const ConfigContext = createContext<MessagerieConfig | null>(null);

export interface MessagerieProviderProps extends MessagerieConfig {
  source: MessagerieSource;
  children: ReactNode;
}

export function MessagerieProvider({ source, children, ...config }: MessagerieProviderProps) {
  return (
    <MessagerieSourceProvider source={source}>
      <ConfigContext value={config}>{children}</ConfigContext>
    </MessagerieSourceProvider>
  );
}

export function useMessagerieConfig(): MessagerieConfig {
  const config = use(ConfigContext);
  if (!config) throw new Error('MessagerieProvider manquant autour de la messagerie.');
  return config;
}
