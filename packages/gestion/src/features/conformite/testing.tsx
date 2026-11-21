import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../baux';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../locataires';
import { createApiConformiteSource } from './api/conformiteSource';
import * as api from './api/responses.fixtures';
import { catalogPath, documentsPath, mockConformiteApi } from './api/testing';
import type { MockRoute } from './api/testing';
import type { ConformiteRole } from './permissions';
import { ConformiteSourceProvider } from './source';

export const documentsUrl = (path: string): string => documentsPath(api.IDS.org, path);
export const catalogUrl = (path: string): string => catalogPath(api.IDS.org, path);
export const typesUrl = catalogUrl('/vocabularies/certificate_type/terms');
export const certificatesUrl = documentsUrl('/certificates');

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export function renderConformite(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'manager', search = '' }: { role?: ConformiteRole | null; search?: string } = {}) {
  const mock = mockConformiteApi({ [`GET ${typesUrl}`]: { body: api.certificateTypes }, ...routes });
  const source = createApiConformiteSource({ client: mock.client, organizationId: api.IDS.org, role }, { fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <LocatairesSourceProvider source={createDemoLocatairesSource()}>
                <BauxSourceProvider source={createDemoBauxSource()}>
                  <ConformiteSourceProvider source={source}>{ui}</ConformiteSourceProvider>
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

export const listRoutes = (body: unknown = api.certificatesPage): Record<string, MockRoute> => ({ [`GET ${certificatesUrl}`]: { body } });

export function rowAt(table: HTMLElement, index: number): HTMLElement {
  const row = within(table).getAllByRole('row')[index + 1];
  if (!row) throw new Error(`Ligne ${String(index)} absente du tableau`);
  return row;
}

export const pdfFile = (name = 'DPE.pdf', content = '%PDF-1.4 test'): File => new File([content], name, { type: 'application/pdf' });
