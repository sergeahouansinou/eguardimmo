import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createDemoBiensSource } from './biens/demo/store';
import type { BiensEnvironment } from './biens/environment';
import { BiensProviders } from './biens/provider';
import { useBiensAction } from './biens/queries';
import { useRenewLease } from './baux/hooks';
import { BAUX_ROOT, BIENS_ROOT, LOCATAIRES_ROOT } from './queryRoots';

const source = createDemoBiensSource({ latencyMs: 0 });
const environment: BiensEnvironment = { Link: ({ children, ...props }) => <a {...props}>{children}</a>, pathname: '/biens', push: () => undefined };

function seeded() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keys = [BIENS_ROOT, BAUX_ROOT, LOCATAIRES_ROOT].map((root) => [...root, 'liste']);
  keys.forEach((key) => { client.setQueryData(key, { items: [] }); });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><BiensProviders source={source} environment={environment}>{children}</BiensProviders></QueryClientProvider>;
  const stale = () => keys.map((key) => client.getQueryState(key)?.isInvalidated ?? false);
  return { wrapper, stale };
}

describe('invalidation croisée de l’occupation', () => {
  it('une action sur un lot invalide les caches biens, baux et locataires', async () => {
    const { wrapper, stale } = seeded();
    const { result } = renderHook(() => useBiensAction((_source, id: string) => Promise.resolve(id)), { wrapper });
    expect(stale()).toEqual([false, false, false]);
    await act(async () => { await result.current.mutateAsync('lot-1'); });
    expect(stale()).toEqual([true, true, true]);
  });

  it('une mutation de bail invalide les caches biens, baux et locataires', async () => {
    const { wrapper, stale } = seeded();
    const { result } = renderHook(() => useRenewLease(), { wrapper });
    expect(stale()).toEqual([false, false, false]);
    await act(async () => { await result.current.mutateAsync('apt-a3'); });
    expect(stale()).toEqual([true, true, true]);
  });
});
