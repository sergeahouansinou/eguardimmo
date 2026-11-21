import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { GestionDataModeProvider, GestionNavigationProvider } from '../locataires';
import type { OrgKind, OrgRole, RoleMatrix } from './model';
import { OrgInfoSourceProvider } from './source';
import type { OrgInfoSource } from './source';

export { mockOwnerFundsApi as mockOrgApi, orgPath } from '../finances/ownerfunds/api/testing';
export type { MockRoute, RecordedCall } from '../finances/ownerfunds/api/testing';

export const TEST_ORG = '0198a0a0-0000-7000-8000-000000000001';
export const TEST_USER = '0198a0a0-0000-7000-8000-0000000000a1';
export const TEST_COLLEAGUE = '0198a0a0-0000-7000-8000-0000000000a2';
export const TEST_PROPERTY = '0198a0a0-0000-7000-8000-0000000000b1';
export const TEST_UNIT = '0198a0a0-0000-7000-8000-0000000000b2';
export const TEST_PARTY = '0198a0a0-0000-7000-8000-0000000000c1';
export const TEST_LEASE = '0198a0a0-0000-7000-8000-0000000000b3';

export const problem = (status: number, code: string, detail = 'detail serveur', extra: Record<string, unknown> = {}) => ({
  status,
  body: { type: 'about:blank', title: 'x', status, code, detail, ...extra },
});

export function roleMatrix(role: OrgRole): RoleMatrix {
  const levels = (owner: string, admin: string, manager: string, accountant: string) => ({ owner, admin, manager, accountant }) as RoleMatrix['domains'][number]['levels'];
  return {
    currentRole: role,
    domains: [
      { key: 'planning', levels: levels('write', 'write', 'write', 'read'), twoFactor: false },
      { key: 'planning_task_progress', levels: levels('write', 'write', 'write', 'write'), twoFactor: false },
      { key: 'parties', levels: levels('write', 'write', 'write', 'read'), twoFactor: false },
      { key: 'parties_anonymize', levels: levels('write', 'write', 'none', 'none'), twoFactor: false },
      { key: 'properties', levels: levels('write', 'write', 'write', 'read'), twoFactor: false },
      { key: 'activity_log', levels: levels('read', 'read', 'read', 'none'), twoFactor: false },
      { key: 'activity_detail', levels: levels('read', 'read', 'none', 'none'), twoFactor: false },
      { key: 'activity_export', levels: levels('write_two_factor', 'write_two_factor', 'none', 'none'), twoFactor: true },
      { key: 'investments', levels: levels('write', 'write', 'none', 'write'), twoFactor: false },
      { key: 'investments_read', levels: levels('read', 'read', 'read', 'read'), twoFactor: false },
      { key: 'tax_read', levels: levels('read', 'read', 'read', 'read'), twoFactor: false },
      { key: 'tax_prepare', levels: levels('write', 'write', 'none', 'write'), twoFactor: false },
      { key: 'tax_publish', levels: levels('write_two_factor', 'write_two_factor', 'write_two_factor', 'none'), twoFactor: true },
      { key: 'tax_export', levels: levels('write_two_factor', 'write_two_factor', 'none', 'write_two_factor'), twoFactor: true },
      { key: 'reporting_assumptions', levels: levels('write', 'write', 'none', 'write'), twoFactor: false },
      { key: 'reporting_finance_export', levels: levels('read', 'read', 'none', 'read'), twoFactor: false },
      { key: 'team', levels: levels('write', 'write', 'read', 'read'), twoFactor: false },
    ],
  };
}

export function orgInfoStub(overrides: Omit<Partial<OrgInfoSource>, 'timezone'> & { role?: OrgRole; kind?: OrgKind; timezone?: string } = {}): OrgInfoSource {
  const { role = 'owner', kind = 'agency', timezone = 'Europe/Paris', ...rest } = overrides;
  return {
    organizationId: TEST_ORG,
    role,
    kind,
    timezone: () => Promise.resolve(timezone),
    updateTimezone: (next) => Promise.resolve(next),
    currentUser: () => Promise.resolve({ id: TEST_USER, name: 'Camille Martin' }),
    members: () =>
      Promise.resolve({
        choices: [
          { userId: TEST_USER, name: 'Camille Martin', self: true },
          { userId: TEST_COLLEAGUE, name: 'Alex Dupont', self: false },
        ],
        complete: true,
      }),
    roles: () => Promise.resolve(roleMatrix(role)),
    properties: () => Promise.resolve([{ id: TEST_PROPERTY, name: 'Résidence des Lilas' }]),
    units: () => Promise.resolve([{ id: TEST_UNIT, reference: 'Apt 12' }]),
    leases: () => Promise.resolve([{ id: TEST_LEASE, reference: 'BAIL-2026-001', tenantNames: ['Marc Chevalier'], unitReference: 'Apt 12', propertyName: 'Résidence des Lilas' }]),
    searchParties: () => Promise.resolve([{ id: TEST_PARTY, name: 'Entreprise Dubois', archived: false }]),
    party: (id) => Promise.resolve({ id, name: 'Entreprise Dubois', archived: false }),
    confirmTwoFactor: () => Promise.resolve({ status: 'ok' }),
    ...rest,
  };
}

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export interface RenderOrgOptions {
  info?: OrgInfoSource;
  search?: string;
  providers?: (children: ReactNode) => ReactNode;
}

export function renderWithOrg(ui: ReactElement, { info = orgInfoStub(), search = '', providers = (children) => children }: RenderOrgOptions = {}) {
  const push = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link: TestLink, push, search: new URLSearchParams(search) }}>
              <OrgInfoSourceProvider source={info}>{providers(ui)}</OrgInfoSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, push, client };
}
