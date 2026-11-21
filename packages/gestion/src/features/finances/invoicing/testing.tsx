import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../../locataires';
import { createApiInvoicingSource } from './api/invoicingSource';
import * as api from './api/responses.fixtures';
import { mockInvoicingApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { InvoicingOrganizationKind, InvoicingRole } from './permissions';
import { InvoicingSourceProvider } from './source';

export const invoicingUrl = (path: string): string => orgPath(api.IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const referenceRoutes = (): Record<string, MockRoute> => ({
  [`GET ${invoicingUrl('/parties')}`]: { body: api.partiesPage },
  [`GET ${invoicingUrl('/catalog/vocabularies/invoice_item/terms')}`]: { body: api.itemTerms },
});

export function renderInvoicing(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'accountant', kind = 'agency', search = '' }: { role?: InvoicingRole | null; kind?: InvoicingOrganizationKind | null; search?: string } = {},
) {
  const mock = mockInvoicingApi({ ...referenceRoutes(), ...routes });
  const source = createApiInvoicingSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { now: () => new Date('2026-11-16T10:00:00Z'), fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <InvoicingSourceProvider source={source}>{ui}</InvoicingSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}

export function rowAt(table: HTMLElement, index: number): HTMLElement {
  const row = within(table).getAllByRole('row')[index + 1];
  if (!row) throw new Error(`Ligne ${String(index)} absente du tableau`);
  return row;
}
