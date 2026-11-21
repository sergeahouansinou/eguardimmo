import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { ExternalMessagerieProvider } from '../src/external/context';
import type { ExternalRoutes } from '../src/external/context';
import { toDetail, toMessage, toSummary } from '../src/external/api/mapping';
import type { ExternalSpace, MessagesPage, ThreadDetail, ThreadMessage, ThreadSummary } from '../src/external/model';
import type { ExternalMessagerieSource } from '../src/external/source';
import { detailResponse, messageFixture, threadFixture } from '../src/external/testing';
import type { MessageFixture, ThreadFixture } from '../src/external/testing';
import { TestLink } from './render';

export const externalRoutes: ExternalRoutes = {
  inbox: '/messages',
  thread: (id) => `/messages/${id}`,
  newThread: '/messages/nouveau',
};

export const summaryOf = (overrides: Partial<ThreadFixture> = {}): ThreadSummary => toSummary(threadFixture(overrides));
export const messageOf = (overrides: Partial<MessageFixture> = {}): ThreadMessage => toMessage(messageFixture(overrides));
export const detailOf = (overrides: Partial<ThreadFixture> = {}, messages: MessageFixture[] = [messageFixture()]): ThreadDetail =>
  toDetail(detailResponse(threadFixture(overrides), messages).data);

export const emptyPage: MessagesPage = { items: [], hasMore: false, nextCursor: null, status: 'open', agencyLastReadAt: null, canReply: true };

type SourceMocks = { [K in keyof ExternalMessagerieSource]: ReturnType<typeof vi.fn<ExternalMessagerieSource[K]>> };

export function fakeSource(overrides: Partial<ExternalMessagerieSource> = {}): SourceMocks {
  const base: ExternalMessagerieSource = {
    listThreads: () => Promise.resolve({ items: [], hasMore: false, nextCursor: null }),
    getThread: () => Promise.resolve(detailOf()),
    listMessages: () => Promise.resolve(emptyPage),
    unreadCount: () => Promise.resolve(0),
    composeOptions: () => Promise.resolve([]),
    openThread: () => Promise.resolve(detailOf()),
    postMessage: () => Promise.resolve(messageOf()),
    markThread: () => Promise.resolve(),
    redactMessage: () => Promise.resolve(messageOf()),
    downloadAttachment: () => Promise.resolve(),
    ...overrides,
  };
  return {
    listThreads: vi.fn(base.listThreads),
    getThread: vi.fn(base.getThread),
    listMessages: vi.fn(base.listMessages),
    unreadCount: vi.fn(base.unreadCount),
    composeOptions: vi.fn(base.composeOptions),
    openThread: vi.fn(base.openThread),
    postMessage: vi.fn(base.postMessage),
    markThread: vi.fn(base.markThread),
    redactMessage: vi.fn(base.redactMessage),
    downloadAttachment: vi.fn(base.downloadAttachment),
  };
}

export function renderExternal(ui: ReactElement, { source = fakeSource(), space = 'tenant' }: { source?: ExternalMessagerieSource; space?: ExternalSpace } = {}) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ExternalMessagerieProvider space={space} source={source} routes={externalRoutes} Link={TestLink} navigate={navigate}>
        {ui}
      </ExternalMessagerieProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, client };
}
