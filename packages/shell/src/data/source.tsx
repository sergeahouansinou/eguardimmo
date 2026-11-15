'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export interface ShellSource {
  shell: () => Promise<unknown>;
  markAllNotificationsRead: () => Promise<void>;
}

const SourceContext = createContext<ShellSource | null>(null);

export function ShellSourceProvider({ source, children }: { source: ShellSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useShellSource(): ShellSource {
  const source = use(SourceContext);
  if (!source) throw new Error('ShellSourceProvider manquant autour de la coquille d’espace.');
  return source;
}
