import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../../locataires';
import { createApiChargesSource } from './api/chargesSource';
import * as api from './api/responses.fixtures';
import { mockChargesApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import { ChargesSourceProvider } from './source';

export const chargesUrl = (path: string): string => orgPath(api.IDS.org, `/charges${path}`);
export const orgUrl = (path: string): string => orgPath(api.IDS.org, path);
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

export const choiceRoutes = (): Record<string, MockRoute> => ({
  [`GET ${orgUrl('/properties')}`]: { body: api.properties },
  [`GET ${orgUrl('/units')}`]: { body: api.units },
  [`GET ${orgUrl('/catalog/vocabularies/expense_category/terms')}`]: { body: api.terms },
  [`GET ${orgUrl('/catalog/vocabularies/charge_rubric/terms')}`]: { body: api.rubrics },
  [`GET ${chargesUrl(`/properties/${api.IDS.property}/charge-keys`)}`]: { body: { data: [api.key] } },
});

export function renderCharges(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'accountant', kind = 'agency', search = '' }: { role?: string | null; kind?: 'agency' | 'individual' | null; search?: string } = {},
) {
  const mock = mockChargesApi({ ...choiceRoutes(), ...routes });
  const source = createApiChargesSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <ChargesSourceProvider source={source}>{ui}</ChargesSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}
