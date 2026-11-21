import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ApiClient } from '@eguardimmo/api';
import type { ComponentProps, ReactNode } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../../locataires';
import { mockOwnerFundsApi, orgPath } from '../../finances/ownerfunds/api/testing';
import type { MockRoute } from '../../finances/ownerfunds/api/testing';
import { TenantRequestsAccessProvider } from '../shared/access';
import { LeaseLookupProvider, createApiLeaseLookup } from '../shared/leaseLookup';
import { tenantRequestsPermissions } from '../shared/permissions';
import { IDS, leaseResponse } from './fixtures';

export type { MockRoute };
export const orgUrl = (path: string): string => orgPath(IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const problem = (status: number, code: string, detail = 'detail serveur', extra: Record<string, unknown> = {}) => ({
  status,
  body: { type: 'about:blank', title: 'x', status, code, detail, ...extra },
});

export interface SourceContext {
  client: ApiClient;
  organizationId: string;
  fetchImpl: typeof fetch;
}

export function renderTenantRequests(
  ui: (context: SourceContext) => ReactNode,
  routes: Record<string, MockRoute>,
  { role = 'manager', search = '' }: { role?: string | null; search?: string } = {},
) {
  const mock = mockOwnerFundsApi({
    [`GET ${orgUrl(`/leases/${IDS.lease}`)}`]: { body: leaseResponse },
    ...routes,
  });
  const context: SourceContext = { client: mock.client, organizationId: IDS.org, fetchImpl: mock.fetchImpl };
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <TenantRequestsAccessProvider source={tenantRequestsPermissions(role)}>
                <LeaseLookupProvider source={createApiLeaseLookup(mock.client, IDS.org, mock.fetchImpl)}>{ui(context)}</LeaseLookupProvider>
              </TenantRequestsAccessProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}
