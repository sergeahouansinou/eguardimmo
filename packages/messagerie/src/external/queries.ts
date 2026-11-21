'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { replaceMessage, withEarlier, withMessages, withMeta } from './api/mapping';
import { useExternalConfig } from './context';
import type { ExternalSpace, MarkInput, OpenInput, PostInput, ThreadDetail, ThreadListQuery, ThreadMessage } from './model';
import { POLL, pollEvery } from './polling';

const MAX_CATCH_UP_PAGES = 5;

export const externalKeys = {
  all: (space: ExternalSpace) => ['messagerie-externe', space] as const,
  lists: (space: ExternalSpace) => ['messagerie-externe', space, 'list'] as const,
  list: (space: ExternalSpace, query: ThreadListQuery) => ['messagerie-externe', space, 'list', query] as const,
  thread: (space: ExternalSpace, id: string) => ['messagerie-externe', space, 'thread', id] as const,
  poll: (space: ExternalSpace, id: string) => ['messagerie-externe', space, 'poll', id] as const,
  unread: (space: ExternalSpace) => ['messagerie-externe', space, 'unread'] as const,
  options: (space: ExternalSpace) => ['messagerie-externe', space, 'options'] as const,
};

function refreshLists(client: QueryClient, space: ExternalSpace): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: externalKeys.lists(space) }),
    client.invalidateQueries({ queryKey: externalKeys.unread(space) }),
  ]);
}

export function useThreads(query: ThreadListQuery) {
  const { source, space } = useExternalConfig();
  return useInfiniteQuery({
    queryKey: externalKeys.list(space, query),
    queryFn: ({ pageParam }) => source.listThreads(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    refetchInterval: pollEvery(POLL.inbox),
    retry: false,
    staleTime: 0,
  });
}

export function useUnreadMessages(): number | undefined {
  const { source, space } = useExternalConfig();
  return useQuery({
    queryKey: externalKeys.unread(space),
    queryFn: () => source.unreadCount(),
    refetchInterval: pollEvery(POLL.unread),
    retry: false,
    staleTime: 0,
  }).data;
}

export function useComposeOptions() {
  const { source, space } = useExternalConfig();
  return useQuery({ queryKey: externalKeys.options(space), queryFn: () => source.composeOptions(), retry: false, staleTime: 60_000 });
}

export function useThread(id: string) {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  const key = externalKeys.thread(space, id);
  const detail = useQuery({ queryKey: key, queryFn: () => source.getThread(id), retry: false, staleTime: 0 });

  useQuery({
    queryKey: externalKeys.poll(space, id),
    enabled: detail.isSuccess,
    initialData: true,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: pollEvery(POLL.thread),
    retry: false,
    staleTime: POLL.thread,
    gcTime: 0,
    queryFn: async () => {
      for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const last = client.getQueryData<ThreadDetail>(key)?.messages.at(-1);
        if (last === undefined) break;
        const batch = await source.listMessages(id, { after: last.id });
        client.setQueryData<ThreadDetail>(key, (current) => (current ? withMeta(withMessages(current, batch.items), batch) : current));
        if (!batch.hasMore) break;
      }
      return true;
    },
  });

  return detail;
}

export function usePostMessage(threadId: string) {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => source.postMessage(threadId, input),
    onSuccess: (message) => {
      client.setQueryData<ThreadDetail>(externalKeys.thread(space, threadId), (current) => (current ? withMessages(current, [message]) : current));
      return refreshLists(client, space);
    },
    onError: () => client.invalidateQueries({ queryKey: externalKeys.thread(space, threadId) }),
  });
}

export function useOpenThread() {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenInput) => source.openThread(input),
    onSuccess: (thread) => {
      client.setQueryData(externalKeys.thread(space, thread.id), thread);
      return refreshLists(client, space);
    },
  });
}

export function useMarkThread() {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: MarkInput & { id: string }) => source.markThread(id, input),
    onSuccess: (_, { id, read, archived }) => {
      client.setQueryData<ThreadDetail>(externalKeys.thread(space, id), (current) =>
        current
          ? { ...current, ...(archived === undefined ? {} : { archived }), ...(read === true ? { unread: false } : {}) }
          : current,
      );
      return refreshLists(client, space);
    },
  });
}

export function useRedactMessage(threadId: string) {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (message: ThreadMessage) => source.redactMessage(threadId, message.id),
    onSuccess: (message) => {
      client.setQueryData<ThreadDetail>(externalKeys.thread(space, threadId), (current) => (current ? replaceMessage(current, message) : current));
      return refreshLists(client, space);
    },
    onError: () => client.invalidateQueries({ queryKey: externalKeys.thread(space, threadId) }),
  });
}

export function useEarlierMessages(threadId: string) {
  const { source, space } = useExternalConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const cursor = client.getQueryData<ThreadDetail>(externalKeys.thread(space, threadId))?.earlierCursor;
      if (cursor === null || cursor === undefined) return null;
      return source.listMessages(threadId, { cursor });
    },
    onSuccess: (page) => {
      if (page === null) return;
      client.setQueryData<ThreadDetail>(externalKeys.thread(space, threadId), (current) => (current ? withEarlier(current, page) : current));
    },
  });
}

export function useDownloadAttachment() {
  const { source } = useExternalConfig();
  return useMutation({ mutationFn: (attachment: { id: string; name: string }) => source.downloadAttachment(attachment) });
}
