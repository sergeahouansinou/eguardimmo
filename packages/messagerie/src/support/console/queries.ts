'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { POLL, pollEvery } from '../../external/polling';
import { isStaleFailure } from './api/errors';
import { withFresh, withMessages, withMeta } from './api/mapping';
import { useConsoleSupportConfig } from './context';
import type {
  ConsolePostInput,
  ConsoleTicketDetail,
  ConsoleTicketPatch,
  ConsoleTicketQuery,
  EmergencyAccessInput,
  RequestAccessInput,
} from './model';

const MAX_CATCH_UP_PAGES = 5;
const REFRESH_MS = 30_000;
const STAFF_STALE_MS = 5 * 60_000;

export const consoleKeys = {
  all: ['support-console'] as const,
  me: ['support-console', 'me'] as const,
  stats: ['support-console', 'stats'] as const,
  lists: ['support-console', 'list'] as const,
  list: (query: ConsoleTicketQuery) => ['support-console', 'list', query] as const,
  ticket: (id: string) => ['support-console', 'ticket', id] as const,
  poll: (id: string) => ['support-console', 'poll', id] as const,
  refresh: (id: string) => ['support-console', 'refresh', id] as const,
  staff: ['support-console', 'staff'] as const,
  team: (organizationId: string) => ['support-console', 'organization', organizationId, 'team'] as const,
  settings: (organizationId: string) => ['support-console', 'organization', organizationId, 'settings'] as const,
};

function refreshLists(client: QueryClient): Promise<unknown> {
  return Promise.all([client.invalidateQueries({ queryKey: consoleKeys.lists }), client.invalidateQueries({ queryKey: consoleKeys.stats })]);
}

export function useOperatorId(): string | undefined {
  const { source } = useConsoleSupportConfig();
  return useQuery({ queryKey: consoleKeys.me, queryFn: () => source.operatorId(), retry: false, staleTime: Infinity }).data;
}

export function useConsoleStats() {
  const { source } = useConsoleSupportConfig();
  return useQuery({ queryKey: consoleKeys.stats, queryFn: () => source.stats(), refetchInterval: pollEvery(POLL.unread), retry: false, staleTime: 0 });
}

export function useConsoleTickets(query: ConsoleTicketQuery) {
  const { source } = useConsoleSupportConfig();
  const operatorId = useOperatorId();
  const needsOperator = query.assignee === 'me';
  return useQuery({
    queryKey: [...consoleKeys.list(query), needsOperator ? (operatorId ?? null) : null] as const,
    enabled: !needsOperator || operatorId !== undefined,
    queryFn: () => source.listTickets(query, operatorId),
    placeholderData: keepPreviousData,
    refetchInterval: pollEvery(POLL.inbox),
    retry: false,
    staleTime: 0,
  });
}

export function useConsoleStaff() {
  const { source } = useConsoleSupportConfig();
  return useQuery({ queryKey: consoleKeys.staff, queryFn: () => source.staff(), retry: false, staleTime: STAFF_STALE_MS });
}

export function useConsoleTicket(id: string) {
  const { source } = useConsoleSupportConfig();
  const client = useQueryClient();
  const key = consoleKeys.ticket(id);
  const detail = useQuery({ queryKey: key, queryFn: () => source.getTicket(id), retry: false, staleTime: 0 });
  useQuery({
    queryKey: consoleKeys.poll(id),
    enabled: detail.isSuccess,
    initialData: true,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: pollEvery(POLL.thread),
    retry: false,
    staleTime: POLL.thread,
    gcTime: 0,
    queryFn: async () => {
      for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const last = client.getQueryData<ConsoleTicketDetail>(key)?.messages.at(-1);
        if (last === undefined) break;
        const batch = await source.listMessages(id, { after: last.id });
        client.setQueryData<ConsoleTicketDetail>(key, (current) => (current ? withMeta(withMessages(current, batch.items), batch) : current));
        if (!batch.hasMore) break;
      }
      return true;
    },
  });
  useQuery({
    queryKey: consoleKeys.refresh(id),
    enabled: detail.isSuccess,
    initialData: true,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: pollEvery(REFRESH_MS),
    retry: false,
    staleTime: REFRESH_MS,
    gcTime: 0,
    queryFn: async () => {
      const fresh = await source.getTicket(id);
      client.setQueryData<ConsoleTicketDetail>(key, (current) => withFresh(current, fresh));
      return true;
    },
  });
  return detail;
}

function useApplyDetail(ticketId: string) {
  const client = useQueryClient();
  return (fresh: ConsoleTicketDetail) => {
    client.setQueryData<ConsoleTicketDetail>(consoleKeys.ticket(ticketId), (current) => withFresh(current, fresh));
    return refreshLists(client);
  };
}

export function useUpdateConsoleTicket(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const apply = useApplyDetail(ticketId);
  return useMutation({ mutationFn: (patch: ConsoleTicketPatch) => source.updateTicket(ticketId, patch), onSuccess: apply });
}

export function useMarkConsoleTicketRead(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const apply = useApplyDetail(ticketId);
  return useMutation({ mutationFn: () => source.markRead(ticketId), onSuccess: apply });
}

export function usePostConsoleMessage(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const client = useQueryClient();
  const apply = useApplyDetail(ticketId);
  return useMutation({
    mutationFn: (input: ConsolePostInput) => source.postMessage(ticketId, input),
    onSuccess: apply,
    onError: () => client.invalidateQueries({ queryKey: consoleKeys.ticket(ticketId) }),
  });
}

function useGrantMutations(ticketId: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: consoleKeys.ticket(ticketId) });
  return { onSuccess: refresh, onError: (error: unknown) => (isStaleFailure(error) ? refresh() : undefined) };
}

export function useRequestAccess(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const effects = useGrantMutations(ticketId);
  return useMutation({ mutationFn: (input: RequestAccessInput) => source.requestAccess(ticketId, input), ...effects });
}

export function useOpenEmergency(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const effects = useGrantMutations(ticketId);
  return useMutation({ mutationFn: (input: EmergencyAccessInput) => source.openEmergency(ticketId, input), ...effects });
}

export function useReviewGrant(ticketId: string) {
  const { source } = useConsoleSupportConfig();
  const effects = useGrantMutations(ticketId);
  return useMutation({ mutationFn: (grantId: string) => source.reviewGrant(grantId), ...effects });
}

export function useOrganizationTeam(organizationId: string, enabled: boolean) {
  const { source } = useConsoleSupportConfig();
  return useQuery({
    queryKey: consoleKeys.team(organizationId),
    enabled,
    queryFn: () => source.organizationTeam(organizationId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useOrganizationSettings(organizationId: string, enabled: boolean) {
  const { source } = useConsoleSupportConfig();
  return useQuery({
    queryKey: consoleKeys.settings(organizationId),
    enabled,
    queryFn: () => source.organizationSettings(organizationId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useDownloadConsoleAttachment() {
  const { source } = useConsoleSupportConfig();
  return useMutation({ mutationFn: (attachment: { id: string; name: string }) => source.downloadAttachment(attachment) });
}
