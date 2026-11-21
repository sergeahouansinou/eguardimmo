'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { POLL, pollEvery } from '../external/polling';
import { useAnnouncementsConfig } from './context';
import { ANNOUNCEMENTS_PER_PAGE, UNREAD_SAMPLE_SIZE, countUnread } from './model';
import type { Announcement, AnnouncementAttachment, AnnouncementPage } from './model';

export const announcementKeys = {
  all: (space: string) => ['annonces', space] as const,
  list: (space: string) => ['annonces', space, 'list'] as const,
  one: (space: string, id: string) => ['annonces', space, 'one', id] as const,
  unread: (space: string) => ['annonces', space, 'unread'] as const,
};

export function useAnnouncements() {
  const { source, space } = useAnnouncementsConfig();
  return useInfiniteQuery({
    queryKey: announcementKeys.list(space),
    queryFn: ({ pageParam }) => source.list(pageParam, ANNOUNCEMENTS_PER_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: (page: AnnouncementPage) => (page.hasMore ? page.nextCursor : undefined),
    retry: false,
    staleTime: 0,
  });
}

export function useAnnouncement(id: string) {
  const { source, space } = useAnnouncementsConfig();
  return useQuery({ queryKey: announcementKeys.one(space, id), queryFn: () => source.get(id), retry: false, staleTime: 0 });
}

export interface UnreadAnnouncements {
  count: number;
  more: boolean;
}

export function useUnreadAnnouncements(): UnreadAnnouncements | undefined {
  const { source, space } = useAnnouncementsConfig();
  return useQuery({
    queryKey: announcementKeys.unread(space),
    queryFn: async (): Promise<UnreadAnnouncements> => {
      const page = await source.list(null, UNREAD_SAMPLE_SIZE);
      return { count: countUnread(page.items), more: page.hasMore };
    },
    refetchInterval: pollEvery(POLL.unread),
    retry: false,
    staleTime: 0,
  }).data;
}

function remember(client: QueryClient, space: string, announcement: Announcement): Promise<unknown> {
  client.setQueryData(announcementKeys.one(space, announcement.id), announcement);
  return Promise.all([
    client.invalidateQueries({ queryKey: announcementKeys.list(space) }),
    client.invalidateQueries({ queryKey: announcementKeys.unread(space) }),
  ]);
}

export function useMarkAnnouncementRead() {
  const { source, space } = useAnnouncementsConfig();
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => source.markRead(id), onSuccess: (announcement) => remember(client, space, announcement) });
}

export function useDownloadAnnouncementAttachment(announcementId: string) {
  const { source } = useAnnouncementsConfig();
  return useMutation({ mutationFn: (attachment: AnnouncementAttachment) => source.downloadAttachment(announcementId, attachment) });
}
