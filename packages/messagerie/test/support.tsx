import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { MessagerieProvider } from '../src/config';
import { createDemoMessagerieSource } from '../src/data/demo';
import { messagerieProfiles } from '../src/profiles';
import { toAvailability, toDetail, toMessage, toSummary } from '../src/support/api/mapping';
import { SupportAccessProvider } from '../src/support/access/context';
import { toGrant } from '../src/support/access/api/mapping';
import type { AccessGrant, AccessPage } from '../src/support/access/model';
import type { SupportAccessSource } from '../src/support/access/source';
import { SupportProvider } from '../src/support/context';
import type { SupportMessagesPage, SupportRequestSpace, SupportRoutes } from '../src/support/model';
import type { SupportSource } from '../src/support/source';
import { accessFixture, statusResponse, supportMessageFixture, supportTicketFixture, ticketDetailResponse } from '../src/support/testing';
import type { AccessFixture, SupportMessageFixture, SupportTicketFixture } from '../src/support/testing';
import { testRoutes, TestLink } from './render';
import { proofStub } from './staff';
import type { ProofStub } from './staff';
import type { StaffRole } from '../src/external/staff/model';

export const supportRoutes: SupportRoutes = {
  board: '/support',
  newRequest: '/support/nouvelle',
  ticket: (id) => `/support/${id}`,
};

export const summaryOf = (overrides: Partial<SupportTicketFixture> = {}) => toSummary(supportTicketFixture(overrides));
export const messageOf = (overrides: Partial<SupportMessageFixture> = {}) => toMessage(supportMessageFixture(overrides));
export const detailOf = (overrides: Partial<SupportTicketFixture> = {}, messages: SupportMessageFixture[] = [supportMessageFixture()]) =>
  toDetail(ticketDetailResponse(supportTicketFixture(overrides), messages).data);
export const availabilityOf = (online = true) => toAvailability(statusResponse(online));

export const emptyMessagesPage: SupportMessagesPage = { items: [], hasMore: false, status: 'open', requesterLastReadAt: null, supportLastReadAt: null };

type SourceMocks = { [K in keyof SupportSource]: ReturnType<typeof vi.fn<SupportSource[K]>> };

export function fakeSupportSource(overrides: Partial<SupportSource> = {}): SourceMocks {
  const base: SupportSource = {
    availability: () => Promise.resolve(availabilityOf()),
    listTickets: () => Promise.resolve([]),
    getTicket: () => Promise.resolve(detailOf()),
    listMessages: () => Promise.resolve(emptyMessagesPage),
    openTicket: () => Promise.resolve(detailOf()),
    postMessage: () => Promise.resolve(detailOf()),
    markRead: () => Promise.resolve(detailOf()),
    downloadAttachment: () => Promise.resolve(),
    ...overrides,
  };
  return {
    availability: vi.fn(base.availability),
    listTickets: vi.fn(base.listTickets),
    getTicket: vi.fn(base.getTicket),
    listMessages: vi.fn(base.listMessages),
    openTicket: vi.fn(base.openTicket),
    postMessage: vi.fn(base.postMessage),
    markRead: vi.fn(base.markRead),
    downloadAttachment: vi.fn(base.downloadAttachment),
  };
}

export function renderSupport(ui: ReactElement, { source = fakeSupportSource(), space = 'tenant' }: { source?: SupportSource; space?: SupportRequestSpace } = {}) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MessagerieProvider
        source={createDemoMessagerieSource({ space: 'locataire' })}
        profile={messagerieProfiles.locataire}
        routes={testRoutes}
        Link={TestLink}
        navigate={navigate}
      >
        <SupportProvider space={space} source={source} routes={supportRoutes} Link={TestLink} navigate={navigate}>
          {ui}
        </SupportProvider>
      </MessagerieProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, client };
}

export const grantOf = (overrides: Partial<AccessFixture> = {}): AccessGrant => toGrant(accessFixture(overrides));

type AccessMocks = { [K in keyof SupportAccessSource]: ReturnType<typeof vi.fn<SupportAccessSource[K]>> };

export function fakeAccessSource(overrides: Partial<SupportAccessSource> = {}): AccessMocks {
  const empty: AccessPage = { items: [], hasMore: false, nextCursor: null };
  const base: SupportAccessSource = {
    list: () => Promise.resolve(empty),
    accept: () => Promise.resolve(grantOf({ status: 'active' })),
    refuse: () => Promise.resolve(grantOf({ status: 'refused' })),
    revoke: () => Promise.resolve(grantOf({ status: 'revoked' })),
    ...overrides,
  };
  return { list: vi.fn(base.list), accept: vi.fn(base.accept), refuse: vi.fn(base.refuse), revoke: vi.fn(base.revoke) };
}

export function renderAccess(
  ui: ReactElement,
  { source = fakeAccessSource(), role = 'admin', proof = proofStub() }: { source?: SupportAccessSource; role?: StaffRole; proof?: ProofStub } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SupportAccessProvider source={source} routes={{ access: '/reglages/acces-support' }} Link={TestLink} role={role} useProof={proof.hook}>
        {ui}
      </SupportAccessProvider>
    </QueryClientProvider>,
  );
  return { ...view, client, proof };
}
