import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { toDetail, toGrant, toMessage, toMessagesPage, toStats, toTicketPage } from '../src/support/console/api/mapping';
import { ConsoleSupportProvider } from '../src/support/console/context';
import type { ConsoleMessagesPage, ConsoleSupportRoutes, ConsoleTicketPage } from '../src/support/console/model';
import type { ConsoleSupportSource } from '../src/support/console/source';
import {
  OPERATOR_ID,
  consoleDetailResponse,
  consoleGrantFixture,
  consoleListResponse,
  consoleMessagesResponse,
  consoleSettingsResponse,
  consoleStaffResponse,
  consoleStatsResponse,
  consoleTeamResponse,
  consoleTicketFixture,
  requesterMessageFixture,
} from '../src/support/console/testing';
import type { ConsoleGrantFixture, ConsoleMessageFixture, ConsoleTicketFixture } from '../src/support/console/testing';
import { TestLink } from './render';

export const consoleRoutes: ConsoleSupportRoutes = { board: '/support', ticket: (id) => `/support/${id}` };

export const consoleDetailOf = (
  overrides: Partial<ConsoleTicketFixture> = {},
  messages: ConsoleMessageFixture[] = [requesterMessageFixture()],
  grants: ConsoleGrantFixture[] = [],
) => toDetail(consoleDetailResponse(consoleTicketFixture(overrides), messages, grants).data);

export const consolePageOf = (tickets: ConsoleTicketFixture[] = [], meta: Parameters<typeof consoleListResponse>[2] = {}): ConsoleTicketPage =>
  toTicketPage(consoleListResponse(tickets, undefined, meta));

export const emptyConsoleMessages: ConsoleMessagesPage = toMessagesPage(consoleMessagesResponse([]));
export const consoleMessageOf = (fixture: ConsoleMessageFixture) => toMessage(fixture);
export const consoleGrantOf = (overrides: Partial<ConsoleGrantFixture> = {}) => toGrant(consoleGrantFixture(overrides));

type SourceMocks = { [K in keyof ConsoleSupportSource]: ReturnType<typeof vi.fn<ConsoleSupportSource[K]>> };

export function fakeConsoleSource(overrides: Partial<ConsoleSupportSource> = {}): SourceMocks {
  const base: ConsoleSupportSource = {
    operatorId: () => Promise.resolve(OPERATOR_ID),
    stats: () => Promise.resolve(toStats(consoleStatsResponse())),
    listTickets: () => Promise.resolve(consolePageOf()),
    getTicket: () => Promise.resolve(consoleDetailOf()),
    listMessages: () => Promise.resolve(emptyConsoleMessages),
    updateTicket: () => Promise.resolve(consoleDetailOf()),
    markRead: () => Promise.resolve(consoleDetailOf()),
    postMessage: () => Promise.resolve(consoleDetailOf()),
    staff: () => Promise.resolve(consoleStaffResponse.data),
    requestAccess: () => Promise.resolve(consoleGrantOf()),
    openEmergency: () => Promise.resolve(consoleGrantOf({ kind: 'emergency', status: 'active' })),
    reviewGrant: () => Promise.resolve(consoleGrantOf({ kind: 'emergency', status: 'active', reviewed: true })),
    organizationTeam: () => Promise.resolve(consoleTeamResponse.data.map((member) => ({ firstName: member.first_name, lastName: member.last_name, role: member.role }))),
    organizationSettings: () => Promise.resolve(consoleSettingsResponse.data),
    downloadAttachment: () => Promise.resolve(),
    ...overrides,
  };
  return {
    operatorId: vi.fn(base.operatorId),
    stats: vi.fn(base.stats),
    listTickets: vi.fn(base.listTickets),
    getTicket: vi.fn(base.getTicket),
    listMessages: vi.fn(base.listMessages),
    updateTicket: vi.fn(base.updateTicket),
    markRead: vi.fn(base.markRead),
    postMessage: vi.fn(base.postMessage),
    staff: vi.fn(base.staff),
    requestAccess: vi.fn(base.requestAccess),
    openEmergency: vi.fn(base.openEmergency),
    reviewGrant: vi.fn(base.reviewGrant),
    organizationTeam: vi.fn(base.organizationTeam),
    organizationSettings: vi.fn(base.organizationSettings),
    downloadAttachment: vi.fn(base.downloadAttachment),
  };
}

export function renderConsoleSupport(ui: ReactElement, { source = fakeConsoleSource() }: { source?: ConsoleSupportSource } = {}) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ConsoleSupportProvider source={source} routes={consoleRoutes} Link={TestLink} navigate={navigate}>
        {ui}
      </ConsoleSupportProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, client };
}
