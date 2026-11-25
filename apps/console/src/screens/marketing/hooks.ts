'use client';

import type { CampaignInput } from '@/platform/marketing/campaignBody';
import type { CampaignDetail, CampaignEstimate, CampaignQuery, CampaignSummary, MarketingOptions } from '@/platform/marketing/marketing';
import { usePlatformMutation, usePlatformQuery } from '@/platform/context';
import type { PlatformQuery } from '@/platform/context';
import type { CursorPage } from '@/platform/transport';

export const useMarketingOptions = (): PlatformQuery<MarketingOptions> => usePlatformQuery(['marketing', 'options'], (api) => api.marketing.options());

export const useCampaigns = (query: CampaignQuery): PlatformQuery<CursorPage<CampaignSummary>> =>
  usePlatformQuery(['marketing', 'campaigns', query], (api) => api.marketing.list(query), { keepPrevious: true });

export const useCampaign = (id: string): PlatformQuery<CampaignDetail> => usePlatformQuery(['marketing', 'campaign', id], (api) => api.marketing.get(id));

export const useEstimate = (id: string, lockVersion: number): PlatformQuery<CampaignEstimate> =>
  usePlatformQuery(['marketing', 'estimate', id, lockVersion], (api) => api.marketing.estimate(id));

export const useSaveCampaign = () =>
  usePlatformMutation((api, { input, target }: { input: CampaignInput; target: { id: string; lockVersion: number } | null }) =>
    target === null ? api.marketing.create(input) : api.marketing.update(target.id, input, target.lockVersion),
  );

export const useReloadCampaign = () => usePlatformMutation((api, id: string) => api.marketing.get(id));

export const useTestCampaign = () => usePlatformMutation((api, id: string) => api.marketing.test(id));

export const useSendCampaign = () =>
  usePlatformMutation((api, input: { id: string; lockVersion: number }) => api.marketing.send(input.id, input.lockVersion));
