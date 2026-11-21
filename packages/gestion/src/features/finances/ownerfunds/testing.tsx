import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../../locataires';
import { createApiOwnerFundsSource } from './api/ownerFundsSource';
import * as api from './api/responses.fixtures';
import { mockOwnerFundsApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { OwnerFundsOrganizationKind, OwnerFundsRole } from './permissions';
import { OwnerFundsSourceProvider } from './source';

export const ownerFundsUrl = (path: string): string => orgPath(api.IDS.org, `/owner-funds${path}`);
export const orgUrl = (path: string): string => orgPath(api.IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const partyRoutes = (): Record<string, MockRoute> => ({
  [`GET ${orgUrl(`/parties/${api.IDS.mandantA}`)}`]: { body: api.partyA },
  [`GET ${orgUrl(`/parties/${api.IDS.mandantB}`)}`]: { body: api.partyB },
});

export function renderOwnerFunds(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'accountant', kind = 'agency', search = '' }: { role?: OwnerFundsRole | null; kind?: OwnerFundsOrganizationKind | null; search?: string } = {},
) {
  const mock = mockOwnerFundsApi({ ...partyRoutes(), ...routes });
  const source = createApiOwnerFundsSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { now: () => new Date('2026-11-16T10:00:00Z'), fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <OwnerFundsSourceProvider source={source}>{ui}</OwnerFundsSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}

export const payoutsRoutes = (): Record<string, MockRoute> => ({
  [`GET ${ownerFundsUrl('/payouts/preview')}`]: { body: api.preview },
  [`GET ${ownerFundsUrl('/batches')}`]: { body: api.batchesPage },
  [`GET ${ownerFundsUrl('/holds')}`]: { body: api.holdsPage },
});

export const batchRoutes = (batch: { data: { id: string } } = api.batchDraft): Record<string, MockRoute> => ({
  [`GET ${ownerFundsUrl(`/batches/${batch.data.id}`)}`]: { body: batch },
});
