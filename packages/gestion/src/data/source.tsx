'use client';

import { ShellSourceProvider } from '@eguardimmo/shell';
import type { ShellSource } from '@eguardimmo/shell';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export interface GestionSource extends ShellSource {
  bureau: () => Promise<unknown>;
}

const SourceContext = createContext<GestionSource | null>(null);

export function GestionSourceProvider({ source, children }: { source: GestionSource; children: ReactNode }) {
  return (
    <SourceContext value={source}>
      <ShellSourceProvider source={source}>{children}</ShellSourceProvider>
    </SourceContext>
  );
}

export function useGestionSource(): GestionSource {
  const source = use(SourceContext);
  if (!source) throw new Error('GestionSourceProvider manquant autour de l’espace de gestion.');
  return source;
}
