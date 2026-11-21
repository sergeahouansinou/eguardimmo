import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { StaffMessagerieProvider } from '../src/external/staff/context';
import type { StaffProof, StaffRoutes } from '../src/external/staff/context';
import { toStaffDetail, toStaffMessage, toStaffSummary } from '../src/external/staff/api/mapping';
import type { OrganizationKind, StaffMessagesPage, StaffRole, StaffThreadDetail } from '../src/external/staff/model';
import type { StaffMessagerieSource } from '../src/external/staff/source';
import { OTHER_STAFF_ID, STAFF_ID, staffDetailResponse, staffMessageFixture, staffThreadFixture } from '../src/external/staff/testing';
import type { StaffMessageFixture, StaffThreadFixture } from '../src/external/staff/testing';
import { TestLink } from './render';

export const staffRoutes: StaffRoutes = {
  section: (section) => (section === 'tenant' ? '/messages' : section === 'owner' ? '/messages?section=mandants' : '/messages/equipe'),
  thread: (id) => `/messages/fil/${id}`,
};

export const staffSummaryOf = (overrides: Partial<StaffThreadFixture> = {}) => toStaffSummary(staffThreadFixture(overrides));
export const staffMessageOf = (overrides: Partial<StaffMessageFixture> = {}) => toStaffMessage(staffMessageFixture(overrides));
export const staffDetailOf = (overrides: Partial<StaffThreadFixture> = {}, messages: StaffMessageFixture[] = [staffMessageFixture()]): StaffThreadDetail =>
  toStaffDetail(staffDetailResponse(staffThreadFixture(overrides), messages).data);

export const emptyStaffPage: StaffMessagesPage = { items: [], hasMore: false, nextCursor: null, status: 'open', counterpartLastReadAt: null };

type SourceMocks = { [K in keyof StaffMessagerieSource]: ReturnType<typeof vi.fn<StaffMessagerieSource[K]>> };

export function fakeStaffSource(overrides: Partial<StaffMessagerieSource> = {}): SourceMocks {
  const base: StaffMessagerieSource = {
    listThreads: () => Promise.resolve({ items: [], hasMore: false, nextCursor: null, counts: { all: 0, awaiting: 0, unread: 0, sent: 0, archived: 0 } }),
    getThread: () => Promise.resolve(staffDetailOf()),
    listMessages: () => Promise.resolve(emptyStaffPage),
    unread: () => Promise.resolve({ internal: 0, tenant: 0, owner: 0 }),
    openThread: () => Promise.resolve(staffDetailOf()),
    postMessage: () => Promise.resolve(staffMessageOf()),
    markThread: () => Promise.resolve(),
    updateThread: () => Promise.resolve(staffDetailOf()),
    redactMessage: () => Promise.resolve(staffMessageOf()),
    restrict: () => Promise.resolve(staffDetailOf()),
    lift: () => Promise.resolve(staffDetailOf()),
    assignees: () => Promise.resolve([{ id: STAFF_ID, name: 'Camille Martin', role: 'admin' }, { id: OTHER_STAFF_ID, name: 'Zoé Adjovi', role: 'manager' }]),
    downloadAttachment: () => Promise.resolve(),
    ...overrides,
  };
  return {
    listThreads: vi.fn(base.listThreads),
    getThread: vi.fn(base.getThread),
    listMessages: vi.fn(base.listMessages),
    unread: vi.fn(base.unread),
    openThread: vi.fn(base.openThread),
    postMessage: vi.fn(base.postMessage),
    markThread: vi.fn(base.markThread),
    updateThread: vi.fn(base.updateThread),
    redactMessage: vi.fn(base.redactMessage),
    restrict: vi.fn(base.restrict),
    lift: vi.fn(base.lift),
    assignees: vi.fn(base.assignees),
    downloadAttachment: vi.fn(base.downloadAttachment),
  };
}

export interface ProofStub {
  hook: () => StaffProof;
  intercept: ReturnType<typeof vi.fn<StaffProof['intercept']>>;
  replays: (() => void)[];
}

export function proofStub(): ProofStub {
  const replays: (() => void)[] = [];
  const intercept = vi.fn<StaffProof['intercept']>((error, replay) => {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
    if (code !== 'reauthentication_required') return false;
    replays.push(replay);
    return true;
  });
  const proof: StaffProof = { dialog: <div data-testid="preuve-2fa" />, intercept };
  return { hook: () => proof, intercept, replays };
}

export interface RenderStaffOptions {
  source?: StaffMessagerieSource;
  role?: StaffRole;
  organizationKind?: OrganizationKind;
  proof?: ProofStub;
}

export function renderStaff(ui: ReactElement, { source = fakeStaffSource(), role = 'admin', organizationKind = 'agency', proof = proofStub() }: RenderStaffOptions = {}) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <StaffMessagerieProvider source={source} routes={staffRoutes} Link={TestLink} navigate={navigate} role={role} organizationKind={organizationKind} useProof={proof.hook}>
        {ui}
      </StaffMessagerieProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, client, proof };
}
