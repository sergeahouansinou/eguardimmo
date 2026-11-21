import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../../baux';
import { demoLeases } from '../../baux/demo';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../../locataires';
import { createApiInvoicingSource } from '../invoicing/api/invoicingSource';
import { InvoicingSourceProvider } from '../invoicing/source';
import { createApiBankingSource } from './api/bankingSource';
import * as api from './api/responses.fixtures';
import { mockBankingApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import { BankingSourceProvider } from './source';

export const bankingUrl = (path: string): string => orgPath(api.IDS.org, `/banking${path}`);
export const orgUrl = (path: string): string => orgPath(api.IDS.org, path);
const baseLease = demoLeases[0];
if (!baseLease) throw new Error('Bail de démonstration absent');
const INVOICING_ROLES = ['owner', 'admin', 'manager', 'accountant'] as const;
export const LEASE_REFERENCE = 'BAIL-2026-001';
const baux = { ...createDemoBauxSource(), leases: () => Promise.resolve([{ ...baseLease, id: api.IDS.lease, reference: LEASE_REFERENCE }]) };

export const PROOF_ROUTE = 'POST /auth/reauthenticate/two-factor';

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const problem = (status: number, code: string, detail = 'detail serveur', extra: Record<string, unknown> = {}) => ({
  status,
  body: { type: 'about:blank', title: 'x', status, code, detail, ...extra },
});

export const twice = (first: MockRoute, then: MockRoute): MockRoute => {
  let count = 0;
  return (call) => {
    count += 1;
    const route = count === 1 ? first : then;
    return typeof route === 'function' ? route(call) : route;
  };
};

export const baseRoutes = (): Record<string, MockRoute> => ({
  [`GET ${bankingUrl('/accounts')}`]: { body: { data: [api.account, api.accountTrust] } },
});

export function renderBanking(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'accountant', search = '' }: { role?: string | null; search?: string } = {},
) {
  const mock = mockBankingApi({ ...baseRoutes(), ...routes });
  const source = createApiBankingSource({ client: mock.client, organizationId: api.IDS.org, role }, { fetchImpl: mock.fetchImpl });
  const invoicing = createApiInvoicingSource({ client: mock.client, organizationId: api.IDS.org, role: INVOICING_ROLES.find((candidate) => candidate === role) ?? null, kind: 'agency' }, { fetchImpl: mock.fetchImpl });
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
                  <InvoicingSourceProvider source={invoicing}>
                    <BankingSourceProvider source={source}>{ui}</BankingSourceProvider>
                  </InvoicingSourceProvider>
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
