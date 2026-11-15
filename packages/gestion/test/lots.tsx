import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../src/features/baux';
import { CourriersSourceProvider, createDemoCourriersSource } from '../src/features/courriers';
import { GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../src/features/locataires';

export const FROZEN_NOW = new Date('2026-11-13T09:00:00Z');

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export function renderLot(ui: ReactElement, { search = '' }: { search?: string } = {}) {
  const push = vi.fn<(href: string) => void>();
  const tenants = createDemoLocatairesSource();
  const baux = createDemoBauxSource();
  const courriers = createDemoCourriersSource();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
            <LocatairesSourceProvider source={tenants}>
              <BauxSourceProvider source={baux}>
                <CourriersSourceProvider source={courriers}>{ui}</CourriersSourceProvider>
              </BauxSourceProvider>
            </LocatairesSourceProvider>
          </GestionNavigationProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, push, sources: { tenants, baux, courriers } };
}

export const norm = (text: string | null | undefined): string => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Aucun élément à l’index ${String(index)}`);
  return item;
}
