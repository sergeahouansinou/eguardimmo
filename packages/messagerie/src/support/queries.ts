'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { POLL, pollEvery } from '../external/polling';
import { withMessages, withMeta } from './api/mapping';
import { useOptionalSupportConfig, useSupportConfig } from './context';
import type { SupportOpenInput, SupportPostInput, SupportTicketDetail } from './model';
import { countUnread } from './unread';

const MAX_CATCH_UP_PAGES = 5;
const AVAILABILITY_POLL_MS = 60_000;

export const supportKeys = {
  all: (space: string) => ['support', space] as const,
  availability: (space: string) => ['support', space, 'availability'] as const,
  tickets: (space: string) => ['support', space, 'tickets'] as const,
  ticket: (space: string, id: string) => ['support', space, 'ticket', id] as const,
  poll: (space: string, id: string) => ['support', space, 'poll', id] as const,
};

export function useSupportAvailability() {
  const { source, space } = useSupportConfig();
  return useQuery({
    queryKey: supportKeys.availability(space),
    queryFn: () => source.availability(),
    refetchInterval: pollEvery(AVAILABILITY_POLL_MS),
    retry: false,
    staleTime: 0,
  });
}

export function useSupportTickets() {
  const { source, space } = useSupportConfig();
  return useQuery({
    queryKey: supportKeys.tickets(space),
    queryFn: () => source.listTickets(),
    refetchInterval: pollEvery(POLL.inbox),
    retry: false,
    staleTime: 0,
  });
}

export function useSupportUnread(): number | undefined {
  const config = useOptionalSupportConfig();
  return useQuery({
    queryKey: supportKeys.tickets(config?.space ?? 'none'),
    enabled: config !== null,
    queryFn: () => (config === null ? Promise.resolve([]) : config.source.listTickets()),
    refetchInterval: pollEvery(POLL.unread),
    retry: false,
    staleTime: 0,
    select: (tickets) => (config === null ? 0 : countUnread(tickets, config.seen)),
  }).data;
}

export function useSupportTicket(id: string) {
  const { source, space } = useSupportConfig();
  const client = useQueryClient();
  const key = supportKeys.ticket(space, id);
  const detail = useQuery({ queryKey: key, queryFn: () => source.getTicket(id), retry: false, staleTime: 0 });

  useQuery({
    queryKey: supportKeys.poll(space, id),
    enabled: detail.isSuccess,
    initialData: true,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: pollEvery(POLL.thread),
    retry: false,
    staleTime: POLL.thread,
    gcTime: 0,
    queryFn: async () => {
      for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const last = client.getQueryData<SupportTicketDetail>(key)?.messages.at(-1);
        if (last === undefined) break;
        const batch = await source.listMessages(id, { after: last.id });
        client.setQueryData<SupportTicketDetail>(key, (current) => (current ? withMeta(withMessages(current, batch.items), batch) : current));
        if (!batch.hasMore) break;
      }
      return true;
    },
  });

  return detail;
}

export function useOpenSupportTicket() {
  const { source, space } = useSupportConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SupportOpenInput) => source.openTicket(input),
    onSuccess: (ticket) => {
      client.setQueryData(supportKeys.ticket(space, ticket.id), ticket);
      return client.invalidateQueries({ queryKey: supportKeys.tickets(space) });
    },
  });
}

export function usePostSupportMessage(ticketId: string) {
  const { source, space } = useSupportConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SupportPostInput) => source.postMessage(ticketId, input),
    onSuccess: (ticket) => {
      client.setQueryData(supportKeys.ticket(space, ticketId), ticket);
      return client.invalidateQueries({ queryKey: supportKeys.tickets(space) });
    },
    onError: () => client.invalidateQueries({ queryKey: supportKeys.ticket(space, ticketId) }),
  });
}

export function useMarkSupportTicketRead() {
  const { source, space, seen } = useSupportConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ticket: { id: string; updatedAt: string }) => source.markRead(ticket.id),
    onSuccess: (ticket) => {
      seen.mark(ticket.id, ticket.updatedAt);
      client.setQueryData<SupportTicketDetail>(supportKeys.ticket(space, ticket.id), (current) =>
        current ? { ...current, requesterLastReadAt: ticket.requesterLastReadAt } : current,
      );
      return client.invalidateQueries({ queryKey: supportKeys.tickets(space) });
    },
  });
}

export function useDownloadSupportAttachment() {
  const { source } = useSupportConfig();
  return useMutation({ mutationFn: (attachment: { id: string; name: string }) => source.downloadAttachment(attachment) });
}
