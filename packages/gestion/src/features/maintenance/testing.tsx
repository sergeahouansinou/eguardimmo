import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../locataires';
import { createApiMaintenanceSource } from './api/maintenanceSource';
import * as api from './api/responses.fixtures';
import { mockMaintenanceApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { MaintenanceOrganizationKind, MaintenanceRole } from './permissions';
import { MaintenanceSourceProvider } from './source';

export const maintenanceUrl = (path: string): string => orgPath(api.IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const referenceRoutes = (): Record<string, MockRoute> => ({
  [`GET ${maintenanceUrl('/units')}`]: { body: api.unitsPage },
  [`GET ${maintenanceUrl('/parties')}`]: { body: api.partiesPage },
  [`GET ${maintenanceUrl('/catalog/vocabularies/intervention_nature/terms')}`]: { body: api.natureTerms },
  [`GET ${maintenanceUrl('/catalog/vocabularies/tax_rate/terms')}`]: { body: api.taxRateTerms },
});

export function renderMaintenance(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'owner', kind = 'agency', search = '' }: { role?: MaintenanceRole | null; kind?: MaintenanceOrganizationKind | null; search?: string } = {},
) {
  const mock = mockMaintenanceApi({ ...referenceRoutes(), ...routes });
  const source = createApiMaintenanceSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { now: () => new Date('2026-11-16T10:00:00Z'), fetchImpl: mock.fetchImpl });
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <MaintenanceSourceProvider source={source}>{ui}</MaintenanceSourceProvider>
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
