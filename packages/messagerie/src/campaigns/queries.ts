'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { pollEvery } from '../external/polling';
import { useCampaignsConfig } from './context';
import type { Campaign, CampaignDraftInput, CampaignListQuery, CampaignPage, CampaignTestInput } from './model';

export const SENDING_POLL_MS = 10_000;

export const campaignKeys = {
  lists: ['campagnes', 'list'] as const,
  list: (query: CampaignListQuery) => ['campagnes', 'list', query] as const,
  one: (id: string) => ['campagnes', 'one', id] as const,
  audiences: ['campagnes', 'audiences'] as const,
};

const pollSending = pollEvery(SENDING_POLL_MS);

export function useCampaigns(query: CampaignListQuery) {
  const { source } = useCampaignsConfig();
  return useInfiniteQuery({
    queryKey: campaignKeys.list(query),
    queryFn: ({ pageParam }) => source.list(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page: CampaignPage) => (page.hasMore ? page.nextCursor : undefined),
    refetchInterval: (state) => {
      const pages = state.state.data?.pages ?? [];
      return pages.some((page) => page.items.some((item) => item.status === 'sending')) ? pollSending(state) : false;
    },
    retry: false,
    staleTime: 0,
  });
}

export function useAudiences() {
  const { source } = useCampaignsConfig();
  return useQuery({ queryKey: campaignKeys.audiences, queryFn: () => source.audiences(), retry: false, staleTime: 60_000 });
}

export function useCampaign(id: string | null) {
  const { source } = useCampaignsConfig();
  return useQuery({
    queryKey: campaignKeys.one(id ?? 'new'),
    enabled: id !== null,
    queryFn: () => source.get(id ?? ''),
    refetchInterval: (state) => (state.state.data?.status === 'sending' ? pollSending(state) : false),
    retry: false,
    staleTime: 0,
  });
}

function remember(client: QueryClient, campaign: Campaign): Promise<unknown> {
  client.setQueryData(campaignKeys.one(campaign.id), campaign);
  return client.invalidateQueries({ queryKey: campaignKeys.lists });
}

export interface SaveCampaignArgs {
  id: string | null;
  lockVersion: number | null;
  input: CampaignDraftInput;
}

export function useSaveCampaign() {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lockVersion, input }: SaveCampaignArgs) => (id === null || lockVersion === null ? source.create(input) : source.update(id, input, lockVersion)),
    onSuccess: (campaign) => remember(client, campaign),
  });
}

export function useSendCampaign() {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => source.send(id), onSuccess: (campaign) => remember(client, campaign) });
}

export function useScheduleCampaign() {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => source.schedule(id, scheduledAt),
    onSuccess: (campaign) => remember(client, campaign),
  });
}

export function useCancelCampaign() {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => source.cancel(id), onSuccess: (campaign) => remember(client, campaign) });
}

export function useAddAttachment(campaignId: string) {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => source.addAttachment(campaignId, file),
    onSettled: () => client.invalidateQueries({ queryKey: campaignKeys.one(campaignId) }),
  });
}

export function useRemoveAttachment(campaignId: string) {
  const { source } = useCampaignsConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => source.removeAttachment(campaignId, attachmentId),
    onSettled: () => client.invalidateQueries({ queryKey: campaignKeys.one(campaignId) }),
  });
}

export function useDownloadAttachment(campaignId: string) {
  const { source } = useCampaignsConfig();
  return useMutation({ mutationFn: (attachment: { id: string; name: string }) => source.downloadAttachment(campaignId, attachment) });
}

export function useSendTest() {
  const { source } = useCampaignsConfig();
  return useMutation({ mutationFn: (input: CampaignTestInput) => source.sendTest(input) });
}
