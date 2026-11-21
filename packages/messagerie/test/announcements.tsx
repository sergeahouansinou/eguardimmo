import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { AnnouncementsProvider } from '../src/announcements/context';
import type { AnnouncementsRoutes } from '../src/announcements/context';
import { toAnnouncement, toAnnouncementPage } from '../src/announcements/api/mapping';
import type { Announcement, AnnouncementPage } from '../src/announcements/model';
import type { AnnouncementsSource } from '../src/announcements/source';
import { announcementFixture, announcementListResponse } from '../src/announcements/testing';
import type { AnnouncementFixture } from '../src/announcements/testing';
import type { ExternalSpace } from '../src/external/model';
import { TestLink } from './render';

export const announcementRoutes: AnnouncementsRoutes = {
  list: '/annonces',
  detail: (id) => `/annonces/${id}`,
  messages: '/messages',
};

export const announcementOf = (overrides: Partial<AnnouncementFixture> = {}): Announcement => toAnnouncement(announcementFixture(overrides));
export const pageOf = (items: AnnouncementFixture[], next: string | null = null): AnnouncementPage =>
  toAnnouncementPage(announcementListResponse(items, { next_cursor: next }));

type SourceMocks = { [K in keyof AnnouncementsSource]: ReturnType<typeof vi.fn<AnnouncementsSource[K]>> };

export function fakeAnnouncements(overrides: Partial<AnnouncementsSource> = {}): SourceMocks {
  const base: AnnouncementsSource = {
    list: () => Promise.resolve(pageOf([])),
    get: () => Promise.resolve(announcementOf()),
    markRead: () => Promise.resolve(announcementOf({ unread: false, read_at: '2026-11-19T10:00:00+00:00' })),
    downloadAttachment: () => Promise.resolve(),
    ...overrides,
  };
  return {
    list: vi.fn(base.list),
    get: vi.fn(base.get),
    markRead: vi.fn(base.markRead),
    downloadAttachment: vi.fn(base.downloadAttachment),
  };
}

export function renderAnnouncements(ui: ReactElement, { source = fakeAnnouncements(), space = 'tenant' }: { source?: AnnouncementsSource; space?: ExternalSpace } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AnnouncementsProvider space={space} source={source} routes={announcementRoutes} Link={TestLink}>
        {ui}
      </AnnouncementsProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
