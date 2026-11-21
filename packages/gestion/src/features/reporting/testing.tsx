import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ShellSourceProvider } from '@eguardimmo/shell';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionDataModeProvider, GestionNavigationProvider } from '../locataires';
import { createApiReportingSource } from './api/reportingSource';
import * as api from './api/responses.fixtures';
import { mockReportingApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { ReportingOrganizationKind, ReportingRole } from './permissions';
import { ReportingSourceProvider } from './source';

export const reportingUrl = (path: string): string => orgPath(api.IDS.org, `/reporting${path}`);
export const orgUrl = (path: string): string => orgPath(api.IDS.org, path);

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export const partyRoutes = (): Record<string, MockRoute> => ({
  [`GET ${orgUrl(`/parties/${api.IDS.mandantA}`)}`]: { body: api.partyA },
  [`GET ${orgUrl(`/parties/${api.IDS.mandantB}`)}`]: { body: api.partyB },
  [`GET ${orgUrl('/mandates/mandants')}`]: { body: api.mandantsPage },
});

const shell = {
  user: { firstName: 'Marc', fullName: 'Marc Chevalier', initials: 'MC', email: 'marc@example.test' },
  workspace: { name: 'Agence Delmas', role: 'owner' },
  counts: {},
  notifications: [],
};
const shellSource = { shell: () => Promise.resolve(shell), markAllNotificationsRead: () => Promise.resolve() };

export function renderReporting(
  ui: ReactElement,
  routes: Record<string, MockRoute>,
  { role = 'owner', kind = 'agency', search = '', queryClient }: { role?: ReportingRole | null; kind?: ReportingOrganizationKind | null; search?: string; queryClient?: QueryClient } = {},
) {
  const mock = mockReportingApi({ ...partyRoutes(), ...routes });
  const source = createApiReportingSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { fetchImpl: mock.fetchImpl, readCookie: () => 'xsrf' });
  const push = vi.fn<(href: string) => void>();
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <ShellSourceProvider source={shellSource}>
                <ReportingSourceProvider source={source}>{ui}</ReportingSourceProvider>
              </ShellSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock, push };
}

export const homeRoutes = (): Record<string, MockRoute> => ({
  [`GET ${reportingUrl('/home/agency-kpis')}`]: { body: api.agencyKpis },
  [`GET ${reportingUrl('/home/agency-payouts')}`]: { body: api.payouts },
  [`GET ${reportingUrl('/home/agency-alerts')}`]: { body: api.alerts },
  [`GET ${reportingUrl('/home/landlord')}`]: { body: api.landlord },
  [`GET ${reportingUrl('/finance/aging')}`]: { body: api.aging },
});

export const reportUrl = (id: string, suffix = ''): string => reportingUrl(`/management-reports/${id}${suffix}`);
