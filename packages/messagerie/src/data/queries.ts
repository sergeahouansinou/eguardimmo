'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import type {
  CampaignQuery,
  ConversationQuery,
  CreateSupportTicketInput,
  NewConversationInput,
  ReplyInput,
  SaveCampaignInput,
  SendCampaignTestInput,
  TicketPatch,
  TicketQuery,
} from './inputs';
import {
  campaignAudienceSchema,
  campaignListSchema,
  campaignSchema,
  campaignTestResultSchema,
  conversationDetailSchema,
  conversationListSchema,
  helpCenterSchema,
  inboxStatsSchema,
  recipientSchema,
  staffMemberSchema,
  supportStatusSchema,
  ticketDetailSchema,
  ticketListSchema,
  ticketStatsSchema,
  ticketSummarySchema,
} from './schemas';
import type {
  Campaign,
  CampaignAudience,
  CampaignBuilding,
  CampaignListResult,
  CampaignTestResult,
  ConversationDetail,
  ConversationList,
  HelpCenterData,
  InboxStats,
  Recipient,
  StaffMember,
  SupportStatus,
  TicketDetail,
  TicketList,
  TicketStats,
  TicketSummary,
} from './schemas';
import { useMessagerieSource } from './source';

export const messagerieKeys = {
  conversations: ['messagerie', 'conversations'] as const,
  conversationList: (query: ConversationQuery) => ['messagerie', 'conversations', 'list', query] as const,
  conversation: (id: string) => ['messagerie', 'conversations', 'detail', id] as const,
  inboxStats: ['messagerie', 'inbox-stats'] as const,
  recipients: ['messagerie', 'recipients'] as const,
  campaigns: ['messagerie', 'campaigns'] as const,
  campaignList: (query: CampaignQuery) => ['messagerie', 'campaigns', 'list', query] as const,
  campaign: (id: string) => ['messagerie', 'campaigns', 'detail', id] as const,
  audiences: ['messagerie', 'audiences'] as const,
  tickets: ['messagerie', 'tickets'] as const,
  ticketList: (query: TicketQuery) => ['messagerie', 'tickets', 'list', query] as const,
  ticket: (id: string) => ['messagerie', 'tickets', 'detail', id] as const,
  ticketStats: ['messagerie', 'ticket-stats'] as const,
  staff: ['messagerie', 'staff'] as const,
  supportStatus: ['messagerie', 'support-status'] as const,
  myTickets: ['messagerie', 'my-tickets'] as const,
  myTicket: (id: string) => ['messagerie', 'my-tickets', 'detail', id] as const,
  help: ['messagerie', 'help'] as const,
};

export interface ClientQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

const subscribeNothing = () => () => undefined;

// Les données ne sont lues qu'après l'hydratation : une requête résolue avant
// l'hydratation d'un sous-arbre provoquerait sinon un écart serveur/client.
function useAfterHydration<T>(query: UseQueryResult<T>): ClientQuery<T> {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const refetch = () => {
    void query.refetch();
  };
  if (!hydrated) return { data: undefined, isError: false, isPending: true, refetch };
  return { data: query.data, isError: query.isError, isPending: query.isPending, refetch };
}

export function useInboxStats(): ClientQuery<InboxStats> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({ queryKey: messagerieKeys.inboxStats, queryFn: async () => inboxStatsSchema.parse(await source.inboxStats()) }),
  );
}

export function useConversations(query: ConversationQuery): ClientQuery<ConversationList> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.conversationList(query),
      queryFn: async () => conversationListSchema.parse(await source.listConversations(query)),
      placeholderData: keepPreviousData,
    }),
  );
}

export function useConversation(id: string): ClientQuery<ConversationDetail> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.conversation(id),
      queryFn: async () => conversationDetailSchema.parse(await source.getConversation(id)),
      retry: false,
    }),
  );
}

export function useRecipients(): ClientQuery<Recipient[]> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.recipients,
      queryFn: async () => z.array(recipientSchema).parse(await source.listRecipients()),
    }),
  );
}

function useInvalidateConversations() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: messagerieKeys.conversations }),
      client.invalidateQueries({ queryKey: messagerieKeys.inboxStats }),
    ]);
}

export function useReplyToConversation(id: string) {
  const source = useMessagerieSource();
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: async (input: ReplyInput) => conversationDetailSchema.parse(await source.replyToConversation(id, input)),
    onSuccess: invalidate,
  });
}

export function useCreateConversation() {
  const source = useMessagerieSource();
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: async (input: NewConversationInput) => conversationDetailSchema.parse(await source.createConversation(input)),
    onSuccess: invalidate,
  });
}

export function useSetConversationRead() {
  const source = useMessagerieSource();
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => source.setConversationRead(id, read),
    onSuccess: invalidate,
  });
}

export function useSetConversationArchived() {
  const source = useMessagerieSource();
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => source.setConversationArchived(id, archived),
    onSuccess: invalidate,
  });
}

export function useCampaigns(query: CampaignQuery): ClientQuery<CampaignListResult> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.campaignList(query),
      queryFn: async () => campaignListSchema.parse(await source.listCampaigns(query)),
      placeholderData: keepPreviousData,
    }),
  );
}

export function useCampaign(id: string | null): ClientQuery<Campaign | null> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.campaign(id ?? ''),
      queryFn: async () => (id === null ? null : campaignSchema.parse(await source.getCampaign(id))),
      retry: false,
    }),
  );
}

export function useCampaignAudiences(): ClientQuery<CampaignAudience[]> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.audiences,
      queryFn: async () => z.array(campaignAudienceSchema).parse(await source.listCampaignAudiences()),
    }),
  );
}

export function useCampaignBuildings(): ClientQuery<CampaignBuilding[]> {
  const audiences = useCampaignAudiences();
  if (audiences.data === undefined) return { ...audiences, data: undefined };
  const buildings = new Map(audiences.data.flatMap((audience) => audience.buildings ?? []).map((building) => [building.id, building]));
  return { ...audiences, data: [...buildings.values()] };
}

export function useSendCampaignTest() {
  const source = useMessagerieSource();
  return useMutation({
    mutationFn: async (input: SendCampaignTestInput): Promise<CampaignTestResult> =>
      campaignTestResultSchema.parse(await source.sendCampaignTest(input)),
  });
}

export function useSaveCampaign() {
  const source = useMessagerieSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCampaignInput) => campaignSchema.parse(await source.saveCampaign(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: messagerieKeys.campaigns }),
  });
}

export function useTickets(query: TicketQuery): ClientQuery<TicketList> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.ticketList(query),
      queryFn: async () => ticketListSchema.parse(await source.listTickets(query)),
      placeholderData: keepPreviousData,
    }),
  );
}

export function useTicketStats(): ClientQuery<TicketStats> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({ queryKey: messagerieKeys.ticketStats, queryFn: async () => ticketStatsSchema.parse(await source.ticketStats()) }),
  );
}

export function useTicket(id: string): ClientQuery<TicketDetail> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.ticket(id),
      queryFn: async () => ticketDetailSchema.parse(await source.getTicket(id)),
      retry: false,
    }),
  );
}

export function useStaff(): ClientQuery<StaffMember[]> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({ queryKey: messagerieKeys.staff, queryFn: async () => z.array(staffMemberSchema).parse(await source.listStaff()) }),
  );
}

function useInvalidateTickets() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: messagerieKeys.tickets }),
      client.invalidateQueries({ queryKey: messagerieKeys.ticketStats }),
      client.invalidateQueries({ queryKey: messagerieKeys.myTickets }),
    ]);
}

export function useUpdateTicket(id: string) {
  const source = useMessagerieSource();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: async (patch: TicketPatch) => ticketDetailSchema.parse(await source.updateTicket(id, patch)),
    onSuccess: invalidate,
  });
}

export function useReplyToTicket(id: string) {
  const source = useMessagerieSource();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: async (input: ReplyInput) => ticketDetailSchema.parse(await source.replyToTicket(id, input)),
    onSuccess: invalidate,
  });
}

export function useRequestTicketAccess(id: string) {
  const source = useMessagerieSource();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: async (reason: string) => ticketDetailSchema.parse(await source.requestTicketAccess(id, reason)),
    onSuccess: invalidate,
  });
}

export function useSupportStatus(): ClientQuery<SupportStatus> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.supportStatus,
      queryFn: async () => supportStatusSchema.parse(await source.supportStatus()),
      refetchInterval: 60_000,
    }),
  );
}

export function useMyTickets(): ClientQuery<TicketSummary[]> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.myTickets,
      queryFn: async () => z.array(ticketSummarySchema).parse(await source.listMyTickets()),
    }),
  );
}

export function useMyTicket(id: string | null): ClientQuery<TicketDetail | null> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({
      queryKey: messagerieKeys.myTicket(id ?? ''),
      queryFn: async () => (id === null ? null : ticketDetailSchema.parse(await source.getMyTicket(id))),
      retry: false,
    }),
  );
}

export function useCreateSupportTicket() {
  const source = useMessagerieSource();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: async (input: CreateSupportTicketInput) => ticketDetailSchema.parse(await source.createSupportTicket(input)),
    onSuccess: invalidate,
  });
}

export function useReplyToMyTicket(id: string) {
  const source = useMessagerieSource();
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: async (input: ReplyInput) => ticketDetailSchema.parse(await source.replyToMyTicket(id, input)),
    onSuccess: invalidate,
  });
}

export function useHelpCenter(): ClientQuery<HelpCenterData> {
  const source = useMessagerieSource();
  return useAfterHydration(
    useQuery({ queryKey: messagerieKeys.help, queryFn: async () => helpCenterSchema.parse(await source.helpCenter()) }),
  );
}
