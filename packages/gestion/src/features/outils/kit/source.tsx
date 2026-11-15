'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export interface SourceContext<S> {
  Provider: (props: { source: S; children: ReactNode }) => ReactNode;
  useSource: () => S;
  resetDefault: () => void;
}

// Sans fournisseur, une source de démonstration unique par session sert les écrans ;
// l'API réelle la remplace en fournissant sa propre source.
export function createSourceContext<S>(createDefault: () => S): SourceContext<S> {
  const Context = createContext<S | null>(null);
  let fallback: S | null = null;
  return {
    Provider: ({ source, children }) => <Context value={source}>{children}</Context>,
    useSource: () => {
      const provided = use(Context);
      if (provided) return provided;
      fallback ??= createDefault();
      return fallback;
    },
    resetDefault: () => {
      fallback = null;
    },
  };
}
