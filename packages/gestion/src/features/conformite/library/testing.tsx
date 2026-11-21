import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../../baux';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../../locataires';
import { createApiConformiteSource } from '../api/conformiteSource';
import { mockConformiteApi } from '../api/testing';
import type { MockRoute } from '../api/testing';
import type { ConformiteRole } from '../permissions';
import { ConformiteSourceProvider } from '../source';
import { createApiLibrarySource } from './api/librarySource';
import * as api from './api/responses.fixtures';
import { LibrarySourceProvider } from './source';

export const libraryUrl = (path = ''): string => `/api/v1/org/${api.IDS.org}/documents/library${path}`;
export const filesUrl = (path: string): string => `/api/v1/org/${api.IDS.org}/documents/files${path}`;
export const certificatesUrl = `/api/v1/org/${api.IDS.org}/documents/certificates`;

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export function createTestLibrarySource(routes: Record<string, MockRoute>, role: ConformiteRole | null = 'manager') {
  const mock = mockConformiteApi(routes);
  const source = createApiLibrarySource({ client: mock.client, organizationId: api.IDS.org, role }, { fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

export function renderLibrary(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'manager', search = '' }: { role?: ConformiteRole | null; search?: string } = {}) {
  const mock = mockConformiteApi({ [`GET ${certificatesUrl}`]: { body: { data: [], links: {}, meta: { per_page: 100, next_cursor: null } } }, ...routes });
  const conformite = createApiConformiteSource({ client: mock.client, organizationId: api.IDS.org, role }, { fetchImpl: mock.fetchImpl });
  const library = createApiLibrarySource({ client: mock.client, organizationId: api.IDS.org, role }, { fetchImpl: mock.fetchImpl });
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
                  <ConformiteSourceProvider source={conformite}>
                    <LibrarySourceProvider source={library}>{ui}</LibrarySourceProvider>
                  </ConformiteSourceProvider>
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

export const pdf = (name = 'Mandat.pdf'): File => new File(['%PDF-1.4 test'], name, { type: 'application/pdf' });
