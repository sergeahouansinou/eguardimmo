import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../../baux';
import { demoLeases } from '../../baux/demo';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../../locataires';
import { createApiRentSource } from './api/rentSource';
import * as api from './api/responses.fixtures';
import { mockRentApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { RentRole } from './permissions';
import { RentSourceProvider } from './source';

export const rentUrl = (path: string): string => orgPath(api.IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

const baseLease = demoLeases[0];
if (!baseLease) throw new Error('Bail de démonstration absent');
export const leaseReference = api.paidDetail.data.lease.reference;
const baux = { ...createDemoBauxSource(), leases: () => Promise.resolve([{ ...baseLease, id: api.IDS.lease, reference: leaseReference }]) };

export function renderRent(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'manager', search = '' }: { role?: RentRole | null; search?: string } = {}) {
  const mock = mockRentApi(routes);
  const source = createApiRentSource({ client: mock.client, organizationId: api.IDS.org, role }, { now: () => new Date('2026-11-16T10:00:00Z'), fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <LocatairesSourceProvider source={createDemoLocatairesSource()}>
                <BauxSourceProvider source={baux}>
                  <RentSourceProvider source={source}>{ui}</RentSourceProvider>
                </BauxSourceProvider>
              </LocatairesSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}

const paidWithoutLines = Object.fromEntries(Object.entries(api.paidDetail.data).filter(([key]) => key !== 'lines'));
const upcomingRow = { ...api.upcomingPage.data[0], id: api.IDS.janInstallment };
const partialRow = api.overduePartialPage.data[0];

export const installmentRows = [upcomingRow, partialRow, paidWithoutLines];

export const pageOf = <T,>(page: { links: unknown; meta: Record<string, unknown> }, data: T[], nextCursor: string | null = null) => ({
  data,
  links: page.links,
  meta: { ...page.meta, next_cursor: nextCursor },
});

export const installmentsPage = (nextCursor: string | null = null) => pageOf(api.upcomingPage, installmentRows, nextCursor);

export const listRoutes = (): Record<string, MockRoute> => ({ [`GET ${rentUrl('/installments')}`]: { body: installmentsPage() } });

export function rowAt(table: HTMLElement, index: number): HTMLElement {
  const row = within(table).getAllByRole('row')[index + 1];
  if (!row) throw new Error(`Ligne ${String(index)} absente du tableau`);
  return row;
}
