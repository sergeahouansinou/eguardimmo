'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export function createSourceContext<S>(name: string, createDefault: () => S) {
  const Context = createContext<S | null>(null);
  let fallback: S | null = null;

  function SourceProvider({ source, children }: { source: S; children: ReactNode }) {
    return <Context value={source}>{children}</Context>;
  }

  function useSource(): S {
    const provided = use(Context);
    if (provided) return provided;
    fallback ??= createDefault();
    return fallback;
  }

  return { SourceProvider, useSource, name };
}
