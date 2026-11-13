'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export interface GestionSource {
  shell: () => Promise<unknown>;
  bureau: () => Promise<unknown>;
  markAllNotificationsRead: () => Promise<void>;
}

const SourceContext = createContext<GestionSource | null>(null);

export function GestionSourceProvider({ source, children }: { source: GestionSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useGestionSource(): GestionSource {
  const source = use(SourceContext);
  if (!source) throw new Error('GestionSourceProvider manquant autour de l’espace de gestion.');
  return source;
}
