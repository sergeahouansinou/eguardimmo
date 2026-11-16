'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export type GestionDataMode = 'demo' | 'api';

const DataModeContext = createContext<GestionDataMode>('demo');

export function GestionDataModeProvider({ mode, children }: { mode: GestionDataMode; children: ReactNode }) {
  return <DataModeContext value={mode}>{children}</DataModeContext>;
}

export function useGestionDataMode(): GestionDataMode {
  return use(DataModeContext);
}

export class MissingSourceError extends Error {
  constructor(name: string) {
    super(`Aucune source « ${name} » n’est montée en mode api : l’écran ne peut pas retomber sur les données de démonstration.`);
    this.name = 'MissingSourceError';
  }
}

export function createSourceContext<S>(name: string, createDefault: () => S) {
  const Context = createContext<S | null>(null);
  let fallback: S | null = null;

  function SourceProvider({ source, children }: { source: S; children: ReactNode }) {
    return <Context value={source}>{children}</Context>;
  }

  function useSource(): S {
    const provided = use(Context);
    const mode = use(DataModeContext);
    if (provided) return provided;
    if (mode === 'api') throw new MissingSourceError(name);
    fallback ??= createDefault();
    return fallback;
  }

  return { SourceProvider, useSource, name };
}
