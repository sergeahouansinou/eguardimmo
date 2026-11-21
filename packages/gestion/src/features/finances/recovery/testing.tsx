import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { BauxSourceProvider, createDemoBauxSource } from '../../baux';
import { demoLeases } from '../../baux/demo';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../../locataires';
import { createApiRecoverySource } from './api/recoverySource';
import * as api from './api/responses.fixtures';
import { mockRecoveryApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import type { RecoveryRole } from './permissions';
import { RecoverySourceProvider } from './source';

export const recoveryUrl = (path: string): string => orgPath(api.IDS.org, `/recovery${path}`);
export const orgUrl = (path: string): string => orgPath(api.IDS.org, path);

export const LEASE_REFERENCE = 'BL-2026-29637';

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

const baseLease = demoLeases[0];
if (!baseLease) throw new Error('Bail de démonstration absent');
const baux = { ...createDemoBauxSource(), leases: () => Promise.resolve([{ ...baseLease, id: api.IDS.lease, reference: LEASE_REFERENCE }]) };

export function renderRecovery(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'manager', search = '' }: { role?: RecoveryRole | null; search?: string } = {}) {
  const mock = mockRecoveryApi(routes);
  const source = createApiRecoverySource({ client: mock.client, organizationId: api.IDS.org, role }, { now: () => new Date('2026-11-16T10:00:00Z'), fetchImpl: mock.fetchImpl });
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
                  <RecoverySourceProvider source={source}>{ui}</RecoverySourceProvider>
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

export const unpaidRoutes = (): Record<string, MockRoute> => ({ [`GET ${recoveryUrl('/unpaid')}`]: { body: api.unpaidAll } });

export const caseRoutes = (detail: unknown = api.caseDetail): Record<string, MockRoute> => ({
  [`GET ${recoveryUrl(`/cases/${api.IDS.case}`)}`]: { body: detail },
  [`GET ${recoveryUrl(`/cases/${api.IDS.case}/acts`)}`]: { body: api.actsPage },
  [`GET ${recoveryUrl(`/bundles/${api.IDS.bundle}`)}`]: { body: api.bundleShow },
});
