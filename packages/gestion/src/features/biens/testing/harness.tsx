import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { createDemoBiensSource } from '../demo/store';
import { BiensProviders } from '../provider';
import type { BiensSource } from '../source';

function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

export interface RenderOptions {
  source?: BiensSource;
  pathname?: string;
}

export function renderBiens(ui: ReactElement, options: RenderOptions = {}) {
  const push = vi.fn<(href: string) => void>();
  const source = options.source ?? createDemoBiensSource({ latencyMs: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <BiensProviders source={source} environment={{ Link: TestLink, pathname: options.pathname ?? '/biens', push }}>
        {ui}
      </BiensProviders>
    </QueryClientProvider>,
  );
  return { ...view, push, source };
}

export function failingSource(failing: readonly string[]): BiensSource {
  const base = createDemoBiensSource({ latencyMs: 0 });
  const broken = () => Promise.reject(new Error('panne simulée'));
  return new Proxy(base, {
    get: (target, key, receiver): unknown => (typeof key === 'string' && failing.includes(key) ? broken : Reflect.get(target, key, receiver)),
  });
}
