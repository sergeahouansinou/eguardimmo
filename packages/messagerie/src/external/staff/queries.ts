'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { POLL, pollEvery } from '../polling';
import { replaceStaffMessage, withStaffEarlier, withStaffMessages, withStaffMeta, withoutMessages } from './api/mapping';
import { useStaffConfig } from './context';
import type {
  RestrictInput,
  StaffListQuery,
  StaffMarkInput,
  StaffMessage,
  StaffOpenInput,
  StaffPostInput,
  StaffThreadDetail,
  StaffUnread,
  StaffUpdateInput,
} from './model';

const MAX_CATCH_UP_PAGES = 5;

export const staffKeys = {
  lists: ['messagerie-equipe', 'list'] as const,
  list: (query: StaffListQuery) => ['messagerie-equipe', 'list', query] as const,
  thread: (id: string) => ['messagerie-equipe', 'thread', id] as const,
  poll: (id: string) => ['messagerie-equipe', 'poll', id] as const,
  unread: ['messagerie-equipe', 'unread'] as const,
  assignees: ['messagerie-equipe', 'assignees'] as const,
};

function refreshLists(client: QueryClient): Promise<unknown> {
  return Promise.all([client.invalidateQueries({ queryKey: staffKeys.lists }), client.invalidateQueries({ queryKey: staffKeys.unread })]);
}

export function useStaffThreads(query: StaffListQuery) {
  const { source } = useStaffConfig();
  return useInfiniteQuery({
    queryKey: staffKeys.list(query),
    queryFn: ({ pageParam }) => source.listThreads(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    refetchInterval: pollEvery(POLL.inbox),
    retry: false,
    staleTime: 0,
  });
}

export function useStaffUnread(): StaffUnread | undefined {
  const { source } = useStaffConfig();
  return useQuery({ queryKey: staffKeys.unread, queryFn: () => source.unread(), refetchInterval: pollEvery(POLL.unread), retry: false, staleTime: 0 }).data;
}

export function useStaffAssignees() {
  const { source } = useStaffConfig();
  return useQuery({ queryKey: staffKeys.assignees, queryFn: () => source.assignees(), retry: false, staleTime: 5 * 60_000 });
}

export function useStaffThread(id: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  const key = staffKeys.thread(id);
  const detail = useQuery({ queryKey: key, queryFn: () => source.getThread(id), retry: false, staleTime: 0 });

  useQuery({
    queryKey: staffKeys.poll(id),
    enabled: detail.isSuccess,
    initialData: true,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: pollEvery(POLL.thread),
    retry: false,
    staleTime: POLL.thread,
    gcTime: 0,
    queryFn: async () => {
      for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const last = client.getQueryData<StaffThreadDetail>(key)?.messages.at(-1);
        if (last === undefined) break;
        const batch = await source.listMessages(id, { after: last.id });
        client.setQueryData<StaffThreadDetail>(key, (current) => (current ? withStaffMeta(withStaffMessages(current, batch.items), batch) : current));
        if (!batch.hasMore) break;
      }
      return true;
    },
  });

  return detail;
}

export function useStaffPostMessage(threadId: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffPostInput) => source.postMessage(threadId, input),
    onSuccess: async (message) => {
      client.setQueryData<StaffThreadDetail>(staffKeys.thread(threadId), (current) => (current ? withStaffMessages(current, [message]) : current));
      await Promise.all([refreshLists(client), client.invalidateQueries({ queryKey: staffKeys.thread(threadId) })]);
    },
    onError: () => client.invalidateQueries({ queryKey: staffKeys.thread(threadId) }),
  });
}

export function useStaffOpenThread() {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffOpenInput) => source.openThread(input),
    onSuccess: (thread) => {
      client.setQueryData(staffKeys.thread(thread.id), thread);
      return refreshLists(client);
    },
  });
}

export function useStaffMarkThread() {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: StaffMarkInput & { id: string }) => source.markThread(id, input),
    onSuccess: (_, { id, read, archived }) => {
      client.setQueryData<StaffThreadDetail>(staffKeys.thread(id), (current) =>
        current ? { ...current, ...(archived === undefined ? {} : { archived }), ...(read === true ? { unread: false } : {}) } : current,
      );
      return refreshLists(client);
    },
  });
}

function keepMessages(client: QueryClient, id: string, next: StaffThreadDetail): StaffThreadDetail {
  const current = client.getQueryData<StaffThreadDetail>(staffKeys.thread(id));
  return current ? withoutMessages(next, current) : next;
}

export function useStaffUpdateThread(threadId: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffUpdateInput) => source.updateThread(threadId, input),
    onSuccess: (next) => {
      client.setQueryData(staffKeys.thread(threadId), keepMessages(client, threadId, next));
      return refreshLists(client);
    },
  });
}

export function useStaffRestrict(threadId: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RestrictInput | null) => (input === null ? source.lift(threadId) : source.restrict(threadId, input)),
    onSuccess: (next) => {
      client.setQueryData(staffKeys.thread(threadId), keepMessages(client, threadId, next));
      return refreshLists(client);
    },
  });
}

export function useStaffRedact(threadId: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ message, reason }: { message: StaffMessage; reason: string | null }) => source.redactMessage(threadId, message.id, reason),
    onSuccess: (message) => {
      client.setQueryData<StaffThreadDetail>(staffKeys.thread(threadId), (current) => (current ? replaceStaffMessage(current, message) : current));
      return refreshLists(client);
    },
  });
}

export function useStaffEarlier(threadId: string) {
  const { source } = useStaffConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const cursor = client.getQueryData<StaffThreadDetail>(staffKeys.thread(threadId))?.earlierCursor;
      if (cursor === null || cursor === undefined) return null;
      return source.listMessages(threadId, { cursor });
    },
    onSuccess: (page) => {
      if (page === null) return;
      client.setQueryData<StaffThreadDetail>(staffKeys.thread(threadId), (current) => (current ? withStaffEarlier(current, page) : current));
    },
  });
}

export function useStaffDownload() {
  const { source } = useStaffConfig();
  return useMutation({ mutationFn: (attachment: { id: string; name: string }) => source.downloadAttachment(attachment) });
}
